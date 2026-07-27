import { NextResponse } from "next/server";
import { BiteshipAdapter, normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { releaseOrderReservation, restockCommittedOrder } from "@/lib/inventory";
import { sha256 } from "@/lib/security";
import { fulfillmentFromBiteshipStatus, handedOverBiteshipStatuses } from "@/lib/shipping-state";
import { serializeBigInt } from "@/lib/serialize";
import { invalidateCatalogCache } from "@/lib/catalog";
import { getBiteshipApiKey } from "@/lib/env";
import { BiteshipBalanceError, reserveBiteshipFunds, reverseBiteshipFunds, syncOrderRevenue } from "@/lib/finance";
import {
  enqueueShipmentTrackingNotification,
  scheduleWhatsappDispatch,
} from "@/lib/whatsapp-notifications";

export async function POST(_: Request, { params }: { params: Promise<{ number: string }> }) {
  const admin = await adminFromRequest(); if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = getBiteshipApiKey();
  if (!apiKey) return NextResponse.json({ error: "BITESHIP_API_KEY belum diisi" }, { status: 503 });
  const { number } = await params;
  const shipment = await prisma.shipment.findFirst({ where: { order: { publicNumber: number } }, include: { order: true }, orderBy: { createdAt: "desc" } });
  if (!shipment?.providerOrderId) return NextResponse.json({ error: "Shipment Biteship belum tersedia" }, { status: 404 });
  try {
    const adapter = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", apiKey);
    const fundReservation = await reserveBiteshipFunds({ kind: "tracking", referenceId: shipment.order.publicNumber, notes: `Sinkronisasi shipment ${shipment.order.publicNumber}`, actorId: String(admin.email) });
    let detail;
    try {
      detail = await adapter.getOrder(shipment.providerOrderId);
    } catch (cause) {
      await reverseBiteshipFunds(fundReservation, `Sinkronisasi shipment ${shipment.order.publicNumber} gagal`);
      throw cause;
    }
    const actual = BigInt(detail.price ?? Number(shipment.actualPrice ?? shipment.quotedPrice));
    const status = normalizeBiteshipStatus(detail.status);
    const waybill = detail.courier?.waybill_id || shipment.waybillId;
    const tracking = detail.courier?.tracking_id || shipment.trackingId;
    const fulfillment = fulfillmentFromBiteshipStatus(status);
    const raw = JSON.parse(JSON.stringify(detail));
    const payloadHash = await sha256(JSON.stringify(raw));
    let whatsappMessageId: string | null = null;
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.shipment.update({ where: { id: shipment.id }, data: { status, waybillId: waybill, trackingId: tracking, actualPrice: actual, priceAdjustment: actual - shipment.quotedPrice, lastProviderSyncAt: new Date(), ...(waybill && waybill !== shipment.waybillId ? { waybillUpdatedAt: new Date() } : {}), raw } });
      const trackingEvent = await tx.shipmentTrackingEvent.upsert({ where: { shipmentId_payloadHash: { shipmentId: shipment.id, payloadHash } }, update: {}, create: { shipmentId: shipment.id, providerStatus: status, note: "Sinkronisasi manual Biteship", occurredAt: new Date(), payloadHash, payload: raw } });
      if (fulfillment && fulfillment !== shipment.order.fulfillmentState) {
        if (fulfillment === "cancelled" && !handedOverBiteshipStatuses.has(normalizeBiteshipStatus(shipment.status))) {
          if (["packed", "shipment_booked", "handover_pending"].includes(shipment.order.fulfillmentState)) await restockCommittedOrder(tx, shipment.orderId, `biteship_sync_${status}`);
          else if (["awaiting_payment", "awaiting_processing", "processing"].includes(shipment.order.fulfillmentState)) await releaseOrderReservation(tx, shipment.orderId, `biteship_sync_${status}`);
        }
        await tx.order.update({ where: { id: shipment.orderId }, data: { fulfillmentState: fulfillment, ...(fulfillment === "cancelled" && shipment.order.paymentState === "paid" ? { paymentState: "refund_pending" } : {}) } });
      }
      await syncOrderRevenue(tx, shipment.orderId, String(admin.email));
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "shipment.synced", entityType: "shipment", entityId: shipment.id, before: { status: shipment.status, waybillId: shipment.waybillId, actualPrice: shipment.actualPrice?.toString() }, after: { status, waybillId: waybill, actualPrice: actual.toString(), fulfillment } } });
      whatsappMessageId = (await enqueueShipmentTrackingNotification(tx, trackingEvent.id))?.id || null;
      return result;
    });
    invalidateCatalogCache();
    scheduleWhatsappDispatch(whatsappMessageId);
    return NextResponse.json({ success: true, shipment: serializeBigInt(updated), fulfillment });
  } catch (error) {
    if (error instanceof BiteshipBalanceError) return NextResponse.json({ error: "Saldo Biteship tidak mencukupi untuk sinkronisasi shipment" }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sinkronisasi gagal" }, { status: 502 });
  }
}
