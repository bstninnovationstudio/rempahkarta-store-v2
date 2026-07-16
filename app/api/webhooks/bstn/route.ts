import { NextResponse } from "next/server";
import { BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { prisma } from "@/lib/db";
import { releaseOrderReservation } from "@/lib/inventory";
import { sha256 } from "@/lib/security";

type WebhookPayload = {
  event?: string;
  payment: {
    payment_id: string;
    project_payment_ref: string;
    status: string;
    amount: number;
    paid_at?: string | null;
  };
};

const failedStatuses = ["expired", "canceled", "failed", "denied"] as const;
function localStatus(status:string){
  if(status==="paid")return "paid" as const;
  if((failedStatuses as readonly string[]).includes(status))return status as (typeof failedStatuses)[number];
  if(status==="refunded")return "refunded" as const;
  if(status==="partially_refunded")return "partially_refunded" as const;
  return "pending" as const;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!process.env.BSTN_RETURN_SIGNATURE_SECRET || !process.env.BSTN_PROJECT_API_KEY) return NextResponse.json({ error: "Webhook BSTN belum dikonfigurasi" }, { status: 503 });
  const signature = request.headers.get("x-bstn-signature") || "";
  const deliveryId = request.headers.get("x-bstn-delivery-id") || await sha256(raw);
  const adapter = new BstnPaymentAdapter(
    process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id",
    process.env.BSTN_PROJECT_API_KEY || "",
    process.env.BSTN_RETURN_SIGNATURE_SECRET || "",
  );
  if (!await adapter.verifyWebhook(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try { payload = JSON.parse(raw) as WebhookPayload; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!payload.payment?.payment_id || !payload.payment.project_payment_ref || !Number.isFinite(payload.payment.amount)) return NextResponse.json({ error: "Payload tidak lengkap" }, { status: 400 });
  const payloadHash = await sha256(raw);
  try {
    await prisma.webhookInbox.create({
      data: {
        source: "bstn",
        deliveryKey: deliveryId,
        signatureValid: true,
        payloadHash,
        headers: { event: request.headers.get("x-bstn-event") },
        payload,
      },
    });
  } catch {
    return NextResponse.json({ success: true });
  }

  const local = await prisma.payment.findUnique({
    where: { providerPaymentId: payload.payment.payment_id },
  });
  if (
    !local ||
    local.projectPaymentRef !== payload.payment.project_payment_ref ||
    Number(local.amount) !== payload.payment.amount
  ) {
    await prisma.webhookInbox.update({
      where: { source_deliveryKey: { source: "bstn", deliveryKey: deliveryId } },
      data: { status: "failed", error: "Payment reference or amount mismatch" },
    });
    return NextResponse.json({ error: "Payment mismatch" }, { status: 409 });
  }

  // The webhook is only a signal; the final status is read back from BSTN.
  const detail = await adapter.getPayment(payload.payment.payment_id);
  const providerStatus = detail.data.status;
  const status = localStatus(providerStatus);

  await prisma.$transaction(async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({ where: { id: local.id } });
    await tx.paymentEvent.create({
      data: {
        paymentId: local.id,
        providerEventId: deliveryId,
        status:providerStatus,
        payload,
        occurredAt: new Date(),
      },
    });

    const order=await tx.order.findUniqueOrThrow({where:{id:local.orderId}});
    if (status === "paid" && current.status !== "paid") {
      await tx.payment.update({
        where: { id: local.id },
        data: {
          status: "paid",
          paidAt: detail.data.paid_at ? new Date(detail.data.paid_at) : new Date(),
          raw: detail.data,
        },
      });
      const wasCancelled=order.fulfillmentState==="cancelled";
      await tx.order.update({where:{id:local.orderId},data:{paymentState:wasCancelled?"refund_pending":"paid",...(order.fulfillmentState==="awaiting_payment"?{fulfillmentState:"awaiting_processing"}: {})}});
      await tx.auditLog.create({data:{actorType:"system",action:wasCancelled?"payment.paid_after_cancel":"payment.paid",entityType:"order",entityId:local.orderId,after:{providerStatus,refundPending:wasCancelled}}});
    } else if (
      (failedStatuses as readonly string[]).includes(status) &&
      !failedStatuses.includes(current.status as (typeof failedStatuses)[number])
    ) {
      const terminal = status as (typeof failedStatuses)[number];
      await tx.payment.update({ where: { id: local.id }, data: { status: terminal, raw: detail.data } });
      await tx.order.update({
        where: { id: local.orderId },
        data: { paymentState: terminal, fulfillmentState: "cancelled" },
      });
      await releaseOrderReservation(tx, local.orderId, `payment_${terminal}`);
      await tx.auditLog.create({data:{actorType:"system",action:`payment.${terminal}`,entityType:"order",entityId:local.orderId,after:{providerStatus}}});
    }else if(status==="refunded"||status==="partially_refunded"){
      await tx.payment.update({where:{id:local.id},data:{status,raw:detail.data}});
      await tx.order.update({where:{id:local.orderId},data:{paymentState:status}});
    }

    await tx.webhookInbox.update({
      where: { source_deliveryKey: { source: "bstn", deliveryKey: deliveryId } },
      data: { status: "processed", processedAt: new Date() },
    });
  });
  return NextResponse.json({ success: true });
}
