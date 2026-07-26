import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { privateImageExists } from "@/lib/local-media";
import { syncOrderRevenue } from "@/lib/finance";

const terminalReturnStates = ["rejected", "closed", "cancelled", "finished", "refunded"] as const;
const schema = z.object({
  reason: z.string().trim().min(2).max(80),
  cause: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(10).max(5_000),
  items: z.array(z.object({
    orderItemId: z.string().min(1).max(191),
    quantity: z.number().int().positive().max(20),
  })).min(1).max(20),
  evidence: z.array(z.string().max(500)).min(1).max(5),
}).superRefine((value, context) => {
  const ids = new Set<string>();
  for (const item of value.items) {
    if (ids.has(item.orderItemId)) {
      context.addIssue({ code: "custom", path: ["items"], message: "Item retur tidak boleh duplikat" });
      break;
    }
    ids.add(item.orderItemId);
  }
  if (new Set(value.evidence).size !== value.evidence.length) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Lampiran bukti tidak boleh duplikat" });
  }
});

class ReturnConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "order:return-request", limit: 5 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Payload tidak valid", details: body.error.flatten() }, { status: 400 });
  const { number } = await params;

  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      items: true,
      returns: { where: { state: { notIn: [...terminalReturnStates] } }, select: { id: true } },
      shipments: { include: { events: { where: { providerStatus: "delivered" }, orderBy: { occurredAt: "desc" }, take: 1 } }, take: 1 },
    },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  if (order.fulfillmentState !== "completed") return NextResponse.json({ error: "Retur baru dapat diajukan setelah paket diterima" }, { status: 409 });
  if (order.returns.length) return NextResponse.json({ error: "Masih ada pengajuan aktif" }, { status: 409 });

  const evidencePrefix = `/api/orders/${encodeURIComponent(number)}/media/`;
  for (const evidencePath of body.data.evidence) {
    if (!evidencePath.startsWith(evidencePrefix)) {
      return NextResponse.json({ error: "Lampiran bukti tidak valid" }, { status: 400 });
    }
    let fileName = "";
    try { fileName = decodeURIComponent(evidencePath.slice(evidencePrefix.length)); }
    catch { return NextResponse.json({ error: "Lampiran bukti tidak valid" }, { status: 400 }); }
    if (!fileName || !await privateImageExists("returns", order.id, fileName)) {
      return NextResponse.json({ error: "Lampiran bukti tidak ditemukan" }, { status: 400 });
    }
  }

  const deliveredAt = order.shipments[0]?.events[0]?.occurredAt ?? order.updatedAt;
  if (Date.now() - deliveredAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Masa pengajuan retur 7 hari telah berakhir" }, { status: 409 });
  }

  let calculatedRefundAmount = BigInt(0);
  for (const requested of body.data.items) {
    const item = order.items.find(candidate => candidate.id === requested.orderItemId);
    if (!item || requested.quantity > item.quantity) {
      return NextResponse.json({ error: "Item retur tidak sesuai dengan pesanan" }, { status: 400 });
    }
    calculatedRefundAmount += item.unitPrice * BigInt(requested.quantity);
  }
  if (calculatedRefundAmount > order.grandTotal) {
    return NextResponse.json({ error: "Nilai pengajuan melebihi nilai pesanan" }, { status: 400 });
  }

  try {
    const returnCase = await prisma.$transaction(async tx => {
      const active = await tx.returnRequest.count({
        where: { orderId: order.id, state: { notIn: [...terminalReturnStates] } },
      });
      if (active > 0) throw new ReturnConflictError("Masih ada pengajuan aktif");

      const claimed = await tx.order.updateMany({
        where: { id: order.id, fulfillmentState: "completed" },
        data: { fulfillmentState: "return_requested", issueOrder: true, issueReason: body.data.reason || "return_requested" },
      });
      if (claimed.count !== 1) throw new ReturnConflictError("Status pesanan berubah. Muat ulang halaman.");

      const created = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          publicNumber: `RET-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          reason: body.data.reason,
          cause: body.data.cause || null,
          description: body.data.description,
          evidence: body.data.evidence,
          refundAmount: calculatedRefundAmount,
          items: { create: body.data.items },
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: "return.requested",
          entityType: "return",
          entityId: created.id,
          after: { reason: body.data.reason, cause: body.data.cause, itemCount: body.data.items.length },
        },
      });
      await syncOrderRevenue(tx, order.id, customer.id);
      return created;
    });
    return NextResponse.json({ success: true, return_number: returnCase.publicNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof ReturnConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Pengajuan retur belum dapat disimpan" }, { status: 500 });
  }
}
