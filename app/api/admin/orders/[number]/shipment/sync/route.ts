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
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

const shipmentRank: Record<string, number> = {
  confirmed: 0, scheduled: 1, allocated: 2, picking_up: 3, picked: 4,
  in_transit: 5, dropping_off: 6, delivered: 7, return_in_transit: 8, returned: 9,
};
const fulfillmentRank: Record<string, number> = {
  awaiting_payment: 0, awaiting_processing: 1, processing: 2, packed: 3,
  shipment_booked: 4, cancel_requested: 4, handover_pending: 5, handed_over: 6,
  completed: 7, return_requested: 8, return_in_transit: 9, returned: 10,
  cancelled: 99, finished: 100,
};

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

function canAdvanceFulfillment(current: string, next: string, currentShipmentStatus: string) {
  if (current === next) return true;
  if (["cancelled", "finished", "returned"].includes(current)) return false;
  if (next === "cancelled") return !handedOverBiteshipStatuses.has(normalizeBiteshipStatus(currentShipmentStatus));
  return (fulfillmentRank[next] ?? -1) >= (fulfillmentRank[current] ?? 0);
}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "admin:shipment-sync", limit: 15 });
  if (!rate.allowed) return rateLimitResponse(rate);
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
    const providerStatus = normalizeBiteshipStatus(detail.status);
    const raw = JSON.parse(JSON.stringify(detail));
    const payloadHash = await sha256(JSON.stringify(raw));
    let whatsappMessageId: string | null = null;
    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Shipment\` WHERE id = ${shipment.id} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${shipment.orderId} FOR UPDATE`);
      const current = await tx.shipment.findUniqueOrThrow({ where: { id: shipment.id }, include: { order: true } });
      const statusAccepted = canAdvanceShipment(current.status, providerStatus);
      const status = statusAccepted ? providerStatus : current.status;
      const actual = BigInt(detail.price ?? Number(current.actualPrice ?? current.quotedPrice));
      const waybill = detail.courier?.waybill_id || current.waybillId;
      const tracking = detail.courier?.tracking_id || current.trackingId;
      const fulfillment = statusAccepted ? fulfillmentFromBiteshipStatus(providerStatus) : undefined;
      const result = await tx.shipment.update({ where: { id: current.id }, data: { status, waybillId: waybill, trackingId: tracking, actualPrice: actual, priceAdjustment: actual - current.quotedPrice, lastProviderSyncAt: new Date(), ...(waybill && waybill !== current.waybillId ? { waybillUpdatedAt: new Date() } : {}), raw } });
      const trackingEvent = await tx.shipmentTrackingEvent.upsert({ where: { shipmentId_payloadHash: { shipmentId: current.id, payloadHash } }, update: {}, create: { shipmentId: current.id, providerStatus, note: "Sinkronisasi manual Biteship", occurredAt: new Date(), payloadHash, payload: raw } });
      if (fulfillment && fulfillment !== current.order.fulfillmentState && canAdvanceFulfillment(current.order.fulfillmentState, fulfillment, current.status)) {
        if (fulfillment === "cancelled" && !handedOverBiteshipStatuses.has(normalizeBiteshipStatus(current.status))) {
          if (["packed", "shipment_booked", "handover_pending"].includes(current.order.fulfillmentState)) await restockCommittedOrder(tx, current.orderId, `biteship_sync_${providerStatus}`);
          else if (["awaiting_payment", "awaiting_processing", "processing"].includes(current.order.fulfillmentState)) await releaseOrderReservation(tx, current.orderId, `biteship_sync_${providerStatus}`);
        }
        const requiresRefund = fulfillment === "cancelled" && current.order.paymentState === "paid";
        const isIssue = ["cancelled", "return_in_transit", "returned"].includes(fulfillment);
        await tx.order.update({ where: { id: current.orderId }, data: { fulfillmentState: fulfillment, ...(requiresRefund ? { paymentState: "refund_pending" } : {}), ...(isIssue && ["paid", "refund_pending"].includes(current.order.paymentState) ? { issueOrder: true, issueReason: providerStatus } : {}) } });
      }
      await syncOrderRevenue(tx, current.orderId, String(admin.email));
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: statusAccepted ? "shipment.synced" : "shipment.sync_ignored", entityType: "shipment", entityId: current.id, before: { status: current.status, waybillId: current.waybillId, actualPrice: current.actualPrice?.toString() }, after: { status, providerStatus, waybillId: waybill, actualPrice: actual.toString(), fulfillment } } });
      whatsappMessageId = (await enqueueShipmentTrackingNotification(tx, trackingEvent.id))?.id || null;
      return result;
    });
    invalidateCatalogCache();
    scheduleWhatsappDispatch(whatsappMessageId);
    return NextResponse.json({ success: true, shipment: serializeBigInt(updated), fulfillment: fulfillmentFromBiteshipStatus(updated.status) });
  } catch (error) {
    if (error instanceof BiteshipBalanceError) return NextResponse.json({ error: "Saldo Biteship tidak mencukupi untuk sinkronisasi shipment" }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sinkronisasi gagal" }, { status: 502 });
  }
}
