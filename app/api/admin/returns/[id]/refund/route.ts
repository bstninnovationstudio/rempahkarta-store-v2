import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { privateImageExists } from "@/lib/local-media";
import { syncOrderRevenue } from "@/lib/finance";

const eligibleStates = ["inspection_passed", "refund_pending", "processing_refund"] as const;
const schema = z.object({
  amount: z.number().int().positive().max(10_000_000_000),
  method: z.string().trim().min(2).max(80),
  reference: z.string().trim().min(3).max(160),
  proofObjectKey: z.string().max(500),
});

class RefundConflictError extends Error {}
class RefundAmountError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, { scope: "admin:refund-complete", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Bukti dan referensi refund wajib diisi", details: body.error.flatten() }, { status: 400 });
  const { id } = await params;
  const proofPrefix = `/api/returns/${encodeURIComponent(id)}/media/`;
  if (!body.data.proofObjectKey.startsWith(proofPrefix)) {
    return NextResponse.json({ error: "Bukti refund tidak valid" }, { status: 400 });
  }
  let proofFileName = "";
  try { proofFileName = decodeURIComponent(body.data.proofObjectKey.slice(proofPrefix.length)); }
  catch { return NextResponse.json({ error: "Bukti refund tidak valid" }, { status: 400 }); }
  if (!proofFileName || !await privateImageExists("refunds", id, proofFileName)) {
    return NextResponse.json({ error: "Bukti refund tidak ditemukan" }, { status: 400 });
  }

  const ret = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      refunds: { where: { status: "completed" }, orderBy: { createdAt: "desc" }, take: 1 },
      order: { include: { payments: { where: { status: "paid" }, orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
  if (!ret || !ret.order.payments[0]) return NextResponse.json({ error: "Retur belum memenuhi syarat refund" }, { status: 409 });
  if (ret.refunds[0]) return NextResponse.json({ success: true, refund: serializeBigInt(ret.refunds[0]) });
  if (!(eligibleStates as readonly string[]).includes(ret.state)) {
    return NextResponse.json({ error: "Retur belum memenuhi syarat refund" }, { status: 409 });
  }

  const nextReturnState = ret.source === "issue" ? "finished" : "refunded";
  const nextFulfillmentState = ret.source === "issue" ? "finished" : ret.order.fulfillmentState;
  const nextIssueOrder = ret.source === "issue" ? false : ret.order.issueOrder;

  try {
    const refund = await prisma.$transaction(async tx => {
      // Serialize refunds for the same order so two different return cases cannot over-refund it.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${ret.orderId} FOR UPDATE`);

      const alreadyRefunded = await tx.refund.aggregate({
        where: { orderId: ret.orderId, status: "completed" },
        _sum: { amount: true },
      });
      const refundedAmount = alreadyRefunded._sum.amount || BigInt(0);
      const remainingOrderAmount = ret.order.grandTotal - refundedAmount;
      const approvedAmount = ret.refundAmount ?? ret.order.grandTotal;
      const maximumAmount = approvedAmount < remainingOrderAmount ? approvedAmount : remainingOrderAmount;
      const requestedAmount = BigInt(body.data.amount);
      if (requestedAmount > maximumAmount || maximumAmount <= BigInt(0)) {
        throw new RefundAmountError("Nominal refund melebihi nilai yang tersisa atau disetujui");
      }

      const claimed = await tx.returnRequest.updateMany({
        where: { id: ret.id, state: { in: [...eligibleStates] } },
        data: { state: nextReturnState },
      });
      if (claimed.count !== 1) throw new RefundConflictError("Refund sudah diproses atau status retur berubah");

      const created = await tx.refund.create({
        data: {
          orderId: ret.orderId,
          paymentId: ret.order.payments[0].id,
          returnRequestId: ret.id,
          amount: requestedAmount,
          status: "completed",
          method: body.data.method,
          reference: body.data.reference,
          proofObjectKey: body.data.proofObjectKey,
          processedBy: String(admin.email),
          processedAt: new Date(),
        },
      });
      const totalRefunded = refundedAmount + requestedAmount;
      await tx.order.update({
        where: { id: ret.orderId },
        data: {
          paymentState: totalRefunded >= ret.order.grandTotal ? "refunded" : "partially_refunded",
          fulfillmentState: nextFulfillmentState,
          issueOrder: nextIssueOrder,
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "refund.completed",
          entityType: "refund",
          entityId: created.id,
          after: { amount: body.data.amount, reference: body.data.reference },
        },
      });
      await syncOrderRevenue(tx, ret.orderId, String(admin.email));
      return created;
    });
    return NextResponse.json({ success: true, refund: serializeBigInt(refund) });
  } catch (error) {
    if (error instanceof RefundAmountError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RefundConflictError) {
      const existing = await prisma.refund.findFirst({ where: { returnRequestId: id, status: "completed" }, orderBy: { createdAt: "desc" } });
      if (existing) return NextResponse.json({ success: true, refund: serializeBigInt(existing) });
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Refund belum dapat disimpan" }, { status: 500 });
  }
}
