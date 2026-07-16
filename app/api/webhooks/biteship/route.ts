import { NextResponse } from "next/server";
import { normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { prisma } from "@/lib/db";
import { releaseOrderReservation, restockCommittedOrder } from "@/lib/inventory";
import { constantTimeEqual, sha256 } from "@/lib/security";
import { cancelledBiteshipStatuses, fulfillmentFromBiteshipStatus, handedOverBiteshipStatuses } from "@/lib/shipping-state";

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

export async function POST(request: Request) {
  const raw = await request.text();
  
  // 1. Accept empty body immediately for Biteship registration probe
  if (!raw || raw.trim() === "") {
    return NextResponse.json({ ok: true, message: "Biteship Webhook Ready" });
  }

  let payload: BiteshipWebhook;
  try {
    payload = JSON.parse(raw) as BiteshipWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Skip verification for test/ping events or incomplete installation pings
  const isTest = !payload.event || payload.event === "ping" || payload.event === "test" || !payload.order_id;

  if (!isTest) {
    const configured = process.env.BITESHIP_WEBHOOK_SHARED_SECRET || "";
    if (!configured) return NextResponse.json({ error: "Webhook secret belum dikonfigurasi" }, { status: 503 });
    const provided = request.headers.get("x-webhook-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!constantTimeEqual(configured, provided)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else {
    // If it's a test event but we resolved it, just return success
    return NextResponse.json({ ok: true, message: "Test event received" });
  }

  const payloadHash = await sha256(raw);
  const deliveryKey = `${payload.event}:${payload.order_id}:${payloadHash}`;
  try { await prisma.webhookInbox.create({data:{source:"biteship",deliveryKey,signatureValid:true,payloadHash,payload}}); }
  catch { return NextResponse.json({ success: true }); }

  const shipment = await prisma.shipment.findFirst({
    where:{OR:[{providerOrderId:payload.order_id},...(payload.courier_tracking_id?[{trackingId:payload.courier_tracking_id}]:[])]},
    include:{order:true},
  });

  await prisma.$transaction(async tx=>{
    if(shipment){
      const normalized=normalizeBiteshipStatus(payload.status);
      const actual=payload.price??payload.order_price;
      const waybill=payload.courier_waybill_id||shipment.waybillId;
      const update:Record<string,unknown>={raw:payload};
      if(payload.courier_tracking_id)update.trackingId=payload.courier_tracking_id;
      if(payload.event==="order.status"&&payload.status)update.status=normalized;
      if((payload.event==="order.price"||actual!=null)&&actual!=null){update.actualPrice=BigInt(actual);update.priceAdjustment=BigInt(actual)-shipment.quotedPrice}
      if(payload.event==="order.waybill_id"&&waybill){update.waybillId=waybill;update.waybillUpdatedAt=new Date()}
      await tx.shipment.update({where:{id:shipment.id},data:update});
      await tx.shipmentTrackingEvent.create({data:{shipmentId:shipment.id,providerStatus:payload.event==="order.status"?normalized:payload.event,note:payload.note||undefined,occurredAt:payload.updated_at?new Date(payload.updated_at):new Date(),payloadHash,payload}});

      if(payload.event==="order.status"&&payload.status){
        const fulfillment=fulfillmentFromBiteshipStatus(normalized);
        const updateData: Record<string, unknown> = {};

        if(fulfillment&&fulfillment!==shipment.order.fulfillmentState){
          if(fulfillment==="cancelled"&&!handedOverBiteshipStatuses.has(normalizeBiteshipStatus(shipment.status))){
            if(["packed","shipment_booked","handover_pending"].includes(shipment.order.fulfillmentState))await restockCommittedOrder(tx,shipment.orderId,`biteship_${normalized}`);
            else if(["awaiting_payment","awaiting_processing","processing"].includes(shipment.order.fulfillmentState))await releaseOrderReservation(tx,shipment.orderId,`biteship_${normalized}`);
          }
          updateData.fulfillmentState = fulfillment;
          if (fulfillment==="cancelled" && shipment.order.paymentState==="paid") {
            updateData.paymentState = "refund_pending";
          }
        }

        const issueStatuses = ["cancelled", "courier_not_found", "rejected", "disposed", "return_in_transit", "returned"];
        const originalStatus = payload.status || "";
        const isIssue = issueStatuses.includes(originalStatus) || issueStatuses.includes(normalized);
        const hasPaid = ["paid", "refund_pending"].includes(shipment.order.paymentState) || updateData.paymentState === "refund_pending";

        if (isIssue && hasPaid) {
          updateData.issueOrder = true;
          updateData.issueReason = originalStatus || normalized;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.order.update({where:{id:shipment.orderId},data:updateData});
        }
      }
      await tx.auditLog.create({data:{actorType:"system",action:`biteship.${payload.event}`,entityType:"shipment",entityId:shipment.id,before:{status:shipment.status,waybillId:shipment.waybillId,actualPrice:shipment.actualPrice?.toString()},after:{status:normalizeBiteshipStatus(payload.status),waybillId:waybill,actualPrice:actual}}});
    }
    await tx.webhookInbox.update({where:{source_deliveryKey:{source:"biteship",deliveryKey}},data:{status:shipment?"processed":"ignored",processedAt:new Date(),error:shipment?null:"Shipment not found"}});
  });
  return NextResponse.json({ success: true });
}
