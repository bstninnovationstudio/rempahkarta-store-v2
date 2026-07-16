import { NextResponse } from "next/server";
import { z } from "zod";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { releaseOrderReservation, restockCommittedOrder } from "@/lib/inventory";

const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().min(3),
  cancellationReasonCode: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Keputusan tidak valid" }, { status: 400 });
  const { number } = await params;
  
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      cancellations: { orderBy: { requestedAt: "desc" }, take: 1 },
      shipments: { take: 1 }
    },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  const cancellation = order.cancellations[0];
  const isDirectCancel = !cancellation || cancellation.state === "approved" || cancellation.state === "rejected";

  if (isDirectCancel && body.data.decision === "rejected") {
    return NextResponse.json({ error: "Tidak ada pengajuan pembatalan aktif untuk ditolak." }, { status: 400 });
  }

  if (!isDirectCancel && body.data.decision === "rejected") {
    await prisma.$transaction([
      prisma.cancellationRequest.update({ where: { id: cancellation.id }, data: { state: "rejected", decisionReason: body.data.reason, decidedAt: new Date(), decidedBy: String(admin.email) } }),
      prisma.order.update({ where: { id: order.id }, data: { fulfillmentState: cancellation.fulfillmentBefore } }),
      prisma.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "cancellation.rejected", entityType: "order", entityId: order.id, after: { reason: body.data.reason } } }),
    ]);
    return NextResponse.json({ success: true, state: "rejected" });
  }

  const shipment = order.shipments[0];
  if (shipment && ["picked", "in_transit", "dropping_off", "delivered", "return_in_transit", "returned"].includes(shipment.status)) {
    return NextResponse.json({ error: "Paket sudah diserahkan ke kurir; gunakan alur retur" }, { status: 409 });
  }
  let providerResult: unknown = undefined;
  if (shipment?.providerOrderId) {
    if(!process.env.BITESHIP_API_KEY)return NextResponse.json({error:"BITESHIP_API_KEY belum diisi"},{status:503});
    if (!body.data.cancellationReasonCode) return NextResponse.json({ error: "Alasan pembatalan Biteship wajib dipilih" }, { status: 400 });
    const biteship = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", process.env.BITESHIP_API_KEY);
    try { providerResult = await biteship.cancelOrder(shipment.providerOrderId, body.data.cancellationReasonCode, body.data.reason); }
    catch (cause) {
      if (!isDirectCancel) {
        await prisma.$transaction([
          prisma.cancellationRequest.update({ where: { id: cancellation.id }, data: { state: "provider_failed", decisionReason: cause instanceof Error ? cause.message : "Pembatalan Biteship gagal", decidedAt: new Date(), decidedBy: String(admin.email) } }),
          prisma.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "cancellation.provider_failed", entityType: "order", entityId: order.id, after: { message: cause instanceof Error ? cause.message : "Biteship error" } } }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.cancellationRequest.create({
            data: {
              orderId: order.id,
              reason: "Dibatalkan langsung oleh admin",
              state: "provider_failed",
              fulfillmentBefore: order.fulfillmentState,
              decisionReason: cause instanceof Error ? cause.message : "Pembatalan Biteship gagal",
              decidedAt: new Date(),
              decidedBy: String(admin.email)
            }
          }),
          prisma.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "cancellation.provider_failed", entityType: "order", entityId: order.id, after: { message: cause instanceof Error ? cause.message : "Biteship error" } } }),
        ]);
      }
      return NextResponse.json({ error: "Pembatalan ke Biteship gagal. Pesanan belum dibatalkan dan dapat dicoba kembali." }, { status: 502 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (isDirectCancel) {
      if (["awaiting_processing", "processing"].includes(order.fulfillmentState)) {
        await releaseOrderReservation(tx, order.id, "admin_direct_cancellation");
      } else if (["packed", "shipment_booked", "handover_pending"].includes(order.fulfillmentState)) {
        await restockCommittedOrder(tx, order.id, "admin_direct_cancellation_before_handover");
      }
      await tx.cancellationRequest.create({
        data: {
          orderId: order.id,
          reason: "Dibatalkan langsung oleh admin",
          state: "approved",
          fulfillmentBefore: order.fulfillmentState,
          decisionReason: body.data.reason,
          providerResult: providerResult as object | undefined,
          decidedAt: new Date(),
          decidedBy: String(admin.email)
        }
      });
    } else {
      if (["awaiting_processing", "processing"].includes(cancellation.fulfillmentBefore)) {
        await releaseOrderReservation(tx, order.id, "cancellation_approved");
      } else if (["packed", "shipment_booked", "handover_pending"].includes(cancellation.fulfillmentBefore)) {
        await restockCommittedOrder(tx, order.id, "cancellation_approved_before_handover");
      }
      await tx.cancellationRequest.update({
        where: { id: cancellation.id },
        data: { state: "approved", decisionReason: body.data.reason, providerResult: providerResult as object | undefined, decidedAt: new Date(), decidedBy: String(admin.email) },
      });
    }
    const isPaid = order.paymentState === "paid";
    await tx.order.update({
      where: { id: order.id },
      data: { 
        fulfillmentState: "cancelled", 
        paymentState: isPaid ? "refund_pending" : order.paymentState,
        issueOrder: isPaid,
        issueReason: isPaid ? "cancelled" : null
      },
    });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: isDirectCancel ? "order.admin_cancelled" : "cancellation.approved", entityType: "order", entityId: order.id, after: { reason: body.data.reason, refundPending: order.paymentState === "paid" } } });
  });
  return NextResponse.json({ success: true, state: "approved", refund_pending: order.paymentState === "paid" });
}
