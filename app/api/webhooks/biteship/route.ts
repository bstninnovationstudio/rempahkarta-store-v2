import { NextResponse } from "next/server";
import { normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { prisma } from "@/lib/db";
import { releaseOrderReservation, restockCommittedOrder } from "@/lib/inventory";
import { constantTimeEqual, isStrongSharedSecret, sha256 } from "@/lib/security";
import { fulfillmentFromBiteshipStatus, handedOverBiteshipStatuses } from "@/lib/shipping-state";
import { invalidateCatalogCache } from "@/lib/catalog";
import { syncOrderRevenue } from "@/lib/finance";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import {
  enqueueShipmentTrackingNotification,
  scheduleWhatsappDispatch,
} from "@/lib/whatsapp-notifications";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hasOversizedContentLength, MAX_WEBHOOK_BYTES } from "@/lib/request-body";

type BiteshipWebhook = {
  event: "order.status" | "order.price" | "order.waybill_id" | string;
  order_id: string;
  courier_tracking_id?: string;
  courier_waybill_id?: string;
  status?: string;
  price?: number;
  order_price?: number;
  note?: string;
  updated_at?: string;
};

const webhookSchema = z.object({
  event: z.string().min(1).max(80).optional(),
  order_id: z.string().min(1).max(120).optional(),
  courier_tracking_id: z.string().max(120).optional(),
  courier_waybill_id: z.string().max(120).optional(),
  status: z.string().max(50).optional(),
  price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  order_price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  note: z.string().max(2_000).optional(),
  updated_at: z.string().max(80).optional(),
}).passthrough();

const fulfillmentRank: Record<string, number> = {
  awaiting_payment: 0,
  awaiting_processing: 1,
  processing: 2,
  packed: 3,
  shipment_booked: 4,
  cancel_requested: 4,
  handover_pending: 5,
  handed_over: 6,
  completed: 7,
  return_requested: 8,
  return_in_transit: 9,
  returned: 10,
  cancelled: 99,
  finished: 100,
};

const shipmentRank: Record<string, number> = {
  confirmed: 0,
  scheduled: 1,
  allocated: 2,
  picking_up: 3,
  picked: 4,
  in_transit: 5,
  dropping_off: 6,
  delivered: 7,
  return_in_transit: 8,
  returned: 9,
};

function canAdvanceFulfillment(current: string, next: string, currentShipmentStatus: string) {
  if (current === next) return true;
  if (["cancelled", "finished", "returned"].includes(current)) return false;
  if (next === "cancelled") return !handedOverBiteshipStatuses.has(normalizeBiteshipStatus(currentShipmentStatus));
  return (fulfillmentRank[next] ?? -1) >= (fulfillmentRank[current] ?? 0);
}

function canAdvanceShipment(current: string, next: string) {
  if (current === next) return true;
  const normalizedCurrent = normalizeBiteshipStatus(current);
  if (["delivered", "returned", "cancelled", "disposed"].includes(normalizedCurrent)) return false;
  if (["cancelled", "rejected", "courier_not_found", "disposed"].includes(next)) {
    return !handedOverBiteshipStatuses.has(normalizedCurrent);
  }
  const currentRank = shipmentRank[normalizedCurrent];
  const nextRank = shipmentRank[next];
  return currentRank == null || nextRank == null || nextRank >= currentRank;
}

export async function POST(request: Request) {
  if (hasOversizedContentLength(request, MAX_WEBHOOK_BYTES)) {
    return NextResponse.json({ error: "Webhook body terlalu besar" }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook body terlalu besar" }, { status: 413 });
  }
  
  // 1. Accept empty body immediately for Biteship registration probe
  if (!raw || raw.trim() === "") {
    return NextResponse.json({ ok: true, message: "Biteship Webhook Ready" });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsedPayload = webhookSchema.safeParse(json);
  if (!parsedPayload.success) return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  const payload = parsedPayload.data as BiteshipWebhook;

  // 2. Skip verification for test/ping events or incomplete installation pings
  const isTest = !payload.event || payload.event === "ping" || payload.event === "test" || !payload.order_id;

  if (!isTest) {
    const configured = process.env.BITESHIP_WEBHOOK_SHARED_SECRET || "";
    if (!isStrongSharedSecret(configured)) return NextResponse.json({ error: "Webhook secret belum dikonfigurasi dengan aman" }, { status: 503 });
    const provided = request.headers.get("x-webhook-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!constantTimeEqual(configured, provided)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else {
    // If it's a test event but we resolved it, just return success
    return NextResponse.json({ ok: true, message: "Test event received" });
  }

  const payloadHash = await sha256(raw);
  const deliveryKeySource = `${payload.event}:${payload.order_id}:${payloadHash}`;
  const deliveryKey = deliveryKeySource.length <= 180
    ? deliveryKeySource
    : `biteship:${await sha256(deliveryKeySource)}`;
  try {
    await prisma.webhookInbox.create({data:{source:"biteship",deliveryKey,signatureValid:true,payloadHash,payload}});
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Webhook belum dapat disimpan" }, { status: 503 });
    }
    const existing = await prisma.webhookInbox.findUnique({ where: { source_deliveryKey: { source: "biteship", deliveryKey } } });
    if (!existing) return NextResponse.json({ error: "Webhook belum dapat diperiksa" }, { status: 503 });
    if (existing.payloadHash !== payloadHash || !existing.signatureValid) return NextResponse.json({ error: "Webhook delivery tidak konsisten" }, { status: 409 });
    if (["processed", "ignored"].includes(existing.status)) return NextResponse.json({ success: true });
    // A prior attempt stopped after inbox insertion. Continue processing the same signed payload.
  }

  const shipment = await prisma.shipment.findFirst({
    where:{OR:[{providerOrderId:payload.order_id},...(payload.courier_tracking_id?[{trackingId:payload.courier_tracking_id}]:[])]},
    include:{order:true},
  });
  if (!shipment) {
    // A provider callback can arrive before the local booking transaction commits.
    // Keep the inbox retryable and return 503 so the provider delivers it again.
    await prisma.webhookInbox.update({
      where: { source_deliveryKey: { source: "biteship", deliveryKey } },
      data: { status: "pending_unmatched", error: "Shipment not found yet", processedAt: null },
    });
    return NextResponse.json({ error: "Shipment belum tersedia" }, { status: 503 });
  }

  const parsedOccurredAt = payload.updated_at ? new Date(payload.updated_at) : null;
  const providerTimestampValid = Boolean(
    parsedOccurredAt &&
    Number.isFinite(parsedOccurredAt.getTime()) &&
    parsedOccurredAt.getTime() <= Date.now() + 5 * 60_000,
  );
  const occurredAt = providerTimestampValid ? parsedOccurredAt! : new Date();
  const outcome = await prisma.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Shipment\` WHERE id = ${shipment.id} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${shipment.orderId} FOR UPDATE`);
    const currentShipment = await tx.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
      include: { order: true },
    });
    const isStaleStatus = Boolean(
      payload.event === "order.status"
      && providerTimestampValid
      && currentShipment.lastProviderSyncAt
      && occurredAt.getTime() < currentShipment.lastProviderSyncAt.getTime()
    );
    if (isStaleStatus) {
      await tx.auditLog.create({ data: { actorType: "system", action: "biteship.stale_ignored", entityType: "shipment", entityId: currentShipment.id, after: { status: payload.status, updatedAt: payload.updated_at } } });
      await tx.webhookInbox.update({ where: { source_deliveryKey: { source: "biteship", deliveryKey } }, data: { status: "ignored", processedAt: new Date(), error: "Stale provider event" } });
      return { stale: true, whatsappMessageId: null as string | null };
    }

    const normalized=normalizeBiteshipStatus(payload.status);
    const actual=payload.price??payload.order_price;
    const waybill=payload.courier_waybill_id||currentShipment.waybillId;
    const statusAccepted = payload.event !== "order.status"
      || !payload.status
      || canAdvanceShipment(currentShipment.status, normalized);
    const appliedStatus = payload.event === "order.status" && payload.status
      ? (statusAccepted ? normalized : currentShipment.status)
      : currentShipment.status;
    const update:Record<string,unknown>={raw:payload};
    if(payload.courier_tracking_id)update.trackingId=payload.courier_tracking_id;
    if(payload.event==="order.status"&&payload.status){
      update.lastProviderSyncAt=occurredAt;
      if(statusAccepted)update.status=normalized;
    }
    if((payload.event==="order.price"||actual!=null)&&actual!=null){update.actualPrice=BigInt(actual);update.priceAdjustment=BigInt(actual)-currentShipment.quotedPrice}
    if(payload.event==="order.waybill_id"&&waybill){update.waybillId=waybill;update.waybillUpdatedAt=new Date()}
    await tx.shipment.update({where:{id:currentShipment.id},data:update});
    const trackingEvent = await tx.shipmentTrackingEvent.create({data:{shipmentId:currentShipment.id,providerStatus:payload.event==="order.status"?normalized:payload.event,note:payload.note||undefined,occurredAt,payloadHash,payload}});

    if(payload.event==="order.status"&&payload.status&&statusAccepted){
      const fulfillment=fulfillmentFromBiteshipStatus(normalized);
      const updateData: Record<string, unknown> = {};

      if(fulfillment&&fulfillment!==currentShipment.order.fulfillmentState&&canAdvanceFulfillment(currentShipment.order.fulfillmentState,fulfillment,currentShipment.status)){
        if(fulfillment==="cancelled"&&!handedOverBiteshipStatuses.has(normalizeBiteshipStatus(currentShipment.status))){
          if(["packed","shipment_booked","handover_pending"].includes(currentShipment.order.fulfillmentState))await restockCommittedOrder(tx,currentShipment.orderId,`biteship_${normalized}`);
          else if(["awaiting_payment","awaiting_processing","processing"].includes(currentShipment.order.fulfillmentState))await releaseOrderReservation(tx,currentShipment.orderId,`biteship_${normalized}`);
        }
        updateData.fulfillmentState = fulfillment;
        if (fulfillment==="cancelled" && currentShipment.order.paymentState==="paid") {
          updateData.paymentState = "refund_pending";
        }
      }

      const issueStatuses = ["cancelled", "courier_not_found", "rejected", "disposed", "return_in_transit", "returned"];
      const originalStatus = payload.status || "";
      const isIssue = issueStatuses.includes(originalStatus) || issueStatuses.includes(normalized);
      const hasPaid = ["paid", "refund_pending"].includes(currentShipment.order.paymentState) || updateData.paymentState === "refund_pending";

      if (isIssue && hasPaid) {
        updateData.issueOrder = true;
        updateData.issueReason = originalStatus || normalized;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.order.update({where:{id:currentShipment.orderId},data:updateData});
      }
    }
    await tx.auditLog.create({data:{actorType:"system",action:statusAccepted?`biteship.${payload.event}`:"biteship.signal_ignored",entityType:"shipment",entityId:currentShipment.id,before:{status:currentShipment.status,waybillId:currentShipment.waybillId,actualPrice:currentShipment.actualPrice?.toString()},after:{status:appliedStatus,providerStatus:normalized,waybillId:waybill,actualPrice:actual}}});
    const whatsappMessageId = (await enqueueShipmentTrackingNotification(tx, trackingEvent.id))?.id || null;
    await syncOrderRevenue(tx, currentShipment.orderId);
    await tx.webhookInbox.update({where:{source_deliveryKey:{source:"biteship",deliveryKey}},data:{status:"processed",processedAt:new Date(),error:null}});
    return { stale: false, whatsappMessageId };
  });
  if (outcome.stale) return NextResponse.json({ success: true });
  invalidateCatalogCache();
  scheduleWhatsappDispatch(outcome.whatsappMessageId);
  return NextResponse.json({ success: true });
}
