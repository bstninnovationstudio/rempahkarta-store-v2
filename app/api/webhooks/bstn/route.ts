import { NextResponse } from "next/server";
import { BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { prisma } from "@/lib/db";
import { releaseOrderReservation } from "@/lib/inventory";
import { isStrongSharedSecret, sha256 } from "@/lib/security";
import { invalidateCatalogCache } from "@/lib/catalog";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import { Prisma } from "@prisma/client";
import { authoritativePaidSourceStates } from "@/lib/payment-sync";
import { getBstnApiKey } from "@/lib/env";

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
  const bstnApiKey = getBstnApiKey();
  if (!isStrongSharedSecret(process.env.BSTN_RETURN_SIGNATURE_SECRET) || !bstnApiKey) return NextResponse.json({ error: "Webhook BSTN belum dikonfigurasi dengan aman" }, { status: 503 });
  const signature = request.headers.get("x-bstn-signature") || "";
  const deliveryId = request.headers.get("x-bstn-delivery-id") || await sha256(raw);
  const adapter = new BstnPaymentAdapter(
    process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id",
    bstnApiKey,
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
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Webhook belum dapat disimpan" }, { status: 503 });
    }
    const existing = await prisma.webhookInbox.findUnique({ where: { source_deliveryKey: { source: "bstn", deliveryKey: deliveryId } } });
    if (!existing) return NextResponse.json({ error: "Webhook belum dapat diperiksa" }, { status: 503 });
    if (existing.payloadHash !== payloadHash || !existing.signatureValid) return NextResponse.json({ error: "Webhook delivery tidak konsisten" }, { status: 409 });
    if (existing.status === "processed") return NextResponse.json({ success: true });
    // Received/failed inbox rows are intentionally retried; only processed is terminal.
  }

  const local = await prisma.payment.findUnique({
    where: { providerPaymentId: payload.payment.payment_id },
  });
  if (!local) {
    // BSTN can notify before the local payment insert becomes visible. Do not
    // permanently consume that delivery; ask the provider to retry it.
    await prisma.webhookInbox.update({
      where: { source_deliveryKey: { source: "bstn", deliveryKey: deliveryId } },
      data: { status: "pending_unmatched", error: "Payment not found yet", processedAt: null },
    });
    return NextResponse.json({ error: "Pembayaran belum tersedia" }, { status: 503 });
  }
  if (
    local.projectPaymentRef !== payload.payment.project_payment_ref ||
    (Number(local.amount) !== payload.payment.amount && Number(local.payableAmount || 0) !== payload.payment.amount)
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
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Payment\` WHERE id = ${local.id} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${local.orderId} FOR UPDATE`);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: local.id } });
    const order=await tx.order.findUniqueOrThrow({where:{id:local.orderId}});
    await tx.paymentEvent.create({
      data: {
        paymentId: local.id,
        providerEventId: deliveryId,
        status:providerStatus,
        payload,
        occurredAt: new Date(),
      },
    });
    let transitioned = false;
    if (status === "paid") {
      const changed = await tx.payment.updateMany({
        where: { id: local.id, status: { in: [...authoritativePaidSourceStates] } },
        data: {
          status: "paid",
          paidAt: detail.data.paid_at ? new Date(detail.data.paid_at) : new Date(),
          raw: detail.data,
        },
      });
      if (changed.count === 1) {
        transitioned = true;
        const wasCancelled=order.fulfillmentState==="cancelled";
        await tx.order.update({where:{id:local.orderId},data:{paymentState:wasCancelled?"refund_pending":"paid",...(order.fulfillmentState==="awaiting_payment"?{fulfillmentState:"awaiting_processing"}: {}),...(wasCancelled?{issueOrder:true,issueReason:"paid_after_cancel"}:{})}});
        await tx.auditLog.create({data:{actorType:"system",action:wasCancelled?"payment.paid_after_cancel":"payment.paid",entityType:"order",entityId:local.orderId,after:{providerStatus,refundPending:wasCancelled}}});
      }
    } else if (
      (failedStatuses as readonly string[]).includes(status)
    ) {
      const terminal = status as (typeof failedStatuses)[number];
      const changed = await tx.payment.updateMany({
        where: { id: local.id, status: { in: ["not_created", "pending"] } },
        data: { status: terminal, raw: detail.data },
      });
      if (changed.count === 1) {
        transitioned = true;
        await tx.order.update({ where: { id: local.orderId }, data: { paymentState: terminal, fulfillmentState: "cancelled" } });
        await releaseOrderReservation(tx, local.orderId, `payment_${terminal}`);
        await tx.auditLog.create({data:{actorType:"system",action:`payment.${terminal}`,entityType:"order",entityId:local.orderId,after:{providerStatus}}});
      }
    }else if(status==="refunded"||status==="partially_refunded"){
      const allowed = status === "refunded"
        ? ["paid", "refund_pending", "partially_refunded"] as const
        : ["paid", "refund_pending"] as const;
      const changed = await tx.payment.updateMany({where:{id:local.id,status:{in:[...allowed]}},data:{status,raw:detail.data}});
      if (changed.count === 1) {
        transitioned = true;
        await tx.order.update({where:{id:local.orderId},data:{paymentState:status}});
      }
    }

    if (!transitioned && current.status !== status) {
      await tx.auditLog.create({
        data: { actorType: "system", action: "payment.signal_ignored", entityType: "order", entityId: local.orderId, after: { currentStatus: current.status, providerStatus } },
      });
    }

    await tx.webhookInbox.update({
      where: { source_deliveryKey: { source: "bstn", deliveryKey: deliveryId } },
      data: { status: "processed", processedAt: new Date() },
    });
  });
  invalidateCatalogCache();
  return NextResponse.json({ success: true });
}
