import { after } from "next/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { GowaError, sendWhatsappImage, sendWhatsappMessage } from "@/lib/gowa";
import {
  formatCustomerShipmentEvent,
  formatWhatsappTimelineMessage,
} from "@/lib/shipment-event";
import { readPrivateImage } from "@/lib/local-media";

type DbClient = Prisma.TransactionClient | PrismaClient;

const notificationPaymentStates = [
  "paid",
  "refund_pending",
  "refunded",
  "partially_refunded",
] as const;

async function verifiedOrderRecipient(tx: DbClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      publicNumber: true,
      paymentState: true,
      user: {
        select: {
          id: true,
          phone: true,
          phoneVerified: true,
          whatsappShipmentNotifications: true,
        },
      },
    },
  });
  if (
    !order?.user?.phone
    || !order.user.phoneVerified
    || !order.user.whatsappShipmentNotifications
    || !notificationPaymentStates.includes(order.paymentState as (typeof notificationPaymentStates)[number])
  ) return null;
  return order;
}

export async function enqueuePaidNotification(
  tx: DbClient,
  input: { orderId: string; paymentId: string; occurredAt: Date },
) {
  const order = await verifiedOrderRecipient(tx, input.orderId);
  if (!order?.user?.phone) return null;
  const body = formatWhatsappTimelineMessage({
    occurredAt: input.occurredAt,
    title: "Pembayaran QRIS berhasil",
    note: "Pesanan diteruskan ke tim fulfillment.",
  });
  return tx.whatsappMessage.upsert({
    where: { dedupeKey: `payment:${input.paymentId}:paid` },
    update: {},
    create: {
      userId: order.user.id,
      orderId: order.id,
      phone: order.user.phone,
      kind: "PAYMENT_EVENT",
      sourceType: "payment",
      sourceId: input.paymentId,
      dedupeKey: `payment:${input.paymentId}:paid`,
      body,
    },
    select: { id: true },
  });
}

export async function enqueueShipmentTrackingNotification(
  tx: DbClient,
  eventId: string,
) {
  const event = await tx.shipmentTrackingEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      providerStatus: true,
      note: true,
      occurredAt: true,
      payload: true,
      shipment: {
        select: {
          orderId: true,
          courierCompany: true,
          courierType: true,
        },
      },
    },
  });
  if (!event) return null;
  const order = await verifiedOrderRecipient(tx, event.shipment.orderId);
  if (!order?.user?.phone) return null;
  const formatted = formatCustomerShipmentEvent({
    providerStatus: event.providerStatus,
    note: event.note,
    payload: event.payload,
    courierCompany: event.shipment.courierCompany,
    courierType: event.shipment.courierType,
  });
  const body = formatWhatsappTimelineMessage({
    occurredAt: event.occurredAt,
    title: formatted.title,
    note: formatted.note,
  });
  return tx.whatsappMessage.upsert({
    where: { dedupeKey: `shipment-event:${event.id}` },
    update: {},
    create: {
      userId: order.user.id,
      orderId: order.id,
      phone: order.user.phone,
      kind: "SHIPMENT_EVENT",
      sourceType: "shipment_tracking_event",
      sourceId: event.id,
      dedupeKey: `shipment-event:${event.id}`,
      body,
    },
    select: { id: true },
  });
}

export async function dispatchWhatsappMessage(messageId: string) {
  const claimed = await prisma.whatsappMessage.updateMany({
    where: { id: messageId, status: "PENDING", attempts: 0 },
    data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
  });
  if (claimed.count !== 1) return;
  const message = await prisma.whatsappMessage.findUnique({
    where: { id: messageId },
    include: {
      campaign: {
        select: { id: true, mediaFileName: true, mediaContentType: true },
      },
      user: {
        select: {
          status: true,
          phoneVerified: true,
          whatsappShipmentNotifications: true,
          whatsappPromotionNotifications: true,
        },
      },
    },
  });
  if (!message) return;
  const eligible = message.kind === "PROMOTION"
    ? message.user?.status === "ACTIVE"
      && message.user.phoneVerified
      && message.user.whatsappPromotionNotifications
    : Boolean(message.user?.phoneVerified && message.user.whatsappShipmentNotifications);
  if (!eligible) {
    await prisma.$transaction([
      prisma.whatsappMessage.update({
        where: { id: message.id },
        data: { status: "SKIPPED", error: "Persetujuan penerima tidak lagi aktif" },
      }),
      prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "whatsapp.notification_skipped",
          entityType: "whatsapp_message",
          entityId: message.id,
          after: { kind: message.kind, reason: "recipient_not_eligible" },
        },
      }),
    ]);
    return;
  }

  try {
    let sent;
    if (message.campaign?.mediaFileName) {
      const image = await readPrivateImage(
        "promotions",
        message.campaign.id,
        message.campaign.mediaFileName,
      );
      if (
        !image
        || !["image/jpeg", "image/png"].includes(image.contentType)
      ) throw new Error("Media promosi tidak ditemukan atau formatnya tidak didukung");
      sent = await sendWhatsappImage(message.phone, message.body, {
        data: image.data,
        contentType: image.contentType as "image/jpeg" | "image/png",
        fileName: message.campaign.mediaFileName,
      });
    } else {
      sent = await sendWhatsappMessage(message.phone, message.body);
    }
    await prisma.$transaction([
      prisma.whatsappMessage.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          providerMessageId: sent.messageId,
          providerCode: sent.code,
          httpStatus: sent.httpStatus,
          error: null,
          sentAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "whatsapp.notification_sent",
          entityType: "whatsapp_message",
          entityId: message.id,
          after: { kind: message.kind, sourceType: message.sourceType },
        },
      }),
    ]);
  } catch (error) {
    const gowaError = error instanceof GowaError ? error : null;
    const status = gowaError?.details.ambiguous ? "AMBIGUOUS" : "FAILED";
    await prisma.$transaction([
      prisma.whatsappMessage.update({
        where: { id: message.id },
        data: {
          status,
          providerCode: gowaError?.details.code,
          httpStatus: gowaError?.details.httpStatus,
          error: error instanceof Error ? error.message.slice(0, 1000) : "Pengiriman gagal",
        },
      }),
      prisma.auditLog.create({
        data: {
          actorType: "system",
          action: status === "AMBIGUOUS"
            ? "whatsapp.notification_ambiguous"
            : "whatsapp.notification_failed",
          entityType: "whatsapp_message",
          entityId: message.id,
          after: { kind: message.kind, sourceType: message.sourceType },
        },
      }),
    ]);
  }
}

export async function refreshPromotionCampaignStats(campaignId: string) {
  const grouped = await prisma.whatsappMessage.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map(item => [item.status, item._count._all]));
  const pending = counts.get("PENDING") || 0;
  const sentCount = counts.get("SENT") || 0;
  const failedCount = counts.get("FAILED") || 0;
  const ambiguousCount = counts.get("AMBIGUOUS") || 0;
  const skippedCount = counts.get("SKIPPED") || 0;
  return prisma.whatsappPromotionCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      failedCount,
      ambiguousCount,
      skippedCount,
      status: pending === 0 ? "COMPLETED" : "SENDING",
      ...(pending === 0 ? { completedAt: new Date() } : {}),
    },
    select: {
      id: true,
      status: true,
      totalRecipients: true,
      sentCount: true,
      failedCount: true,
      ambiguousCount: true,
      skippedCount: true,
      completedAt: true,
    },
  });
}

export function scheduleWhatsappDispatch(messageId: string | null | undefined) {
  if (!messageId) return;
  after(async () => {
    await dispatchWhatsappMessage(messageId);
  });
}
