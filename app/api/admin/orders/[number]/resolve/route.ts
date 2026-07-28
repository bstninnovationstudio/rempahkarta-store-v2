import { NextResponse } from "next/server";
import { Prisma, type ReturnState } from "@prisma/client";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncOrderRevenue } from "@/lib/finance";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  type: z.enum(["refund", "finish"]),
});

class ResolveConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "admin:order-resolve", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Tipe resolusi tidak valid" }, { status: 400 });

  const { number } = await params;
  const found = await prisma.order.findUnique({
    where: { publicNumber: number },
    select: { id: true },
  });
  if (!found) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  try {
    if (body.data.type === "finish") {
      const result = await prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${found.id} FOR UPDATE`);
        const current = await tx.order.findUniqueOrThrow({ where: { id: found.id } });
        if (current.fulfillmentState === "finished" && !current.issueOrder) {
          return { changed: false };
        }
        if (!current.issueOrder) {
          throw new ResolveConflictError("Pesanan ini tidak memiliki kendala aktif untuk diselesaikan.");
        }
        await tx.order.update({
          where: { id: current.id },
          data: {
            issueOrder: false,
            issueReason: null,
            fulfillmentState: "finished",
          },
        });
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: String(admin.email),
            action: "order.issue_resolved_finish",
            entityType: "order",
            entityId: current.id,
            before: {
              issueOrder: current.issueOrder,
              issueReason: current.issueReason,
              fulfillmentState: current.fulfillmentState,
            },
            after: { issueOrder: false, fulfillmentState: "finished" },
          },
        });
        await syncOrderRevenue(tx, current.id, String(admin.email));
        return { changed: true };
      });
      return NextResponse.json({ success: true, changed: result.changed });
    }

    const terminalReturnStates: ReturnState[] = ["rejected", "closed", "cancelled", "finished", "refunded"];
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${found.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({
        where: { id: found.id },
        include: { items: true },
      });
      if (!current.issueOrder) {
        throw new ResolveConflictError("Pesanan ini tidak memiliki kendala aktif untuk dibuatkan refund.");
      }
      const existingReturn = await tx.returnRequest.findFirst({
        where: {
          orderId: current.id,
          state: { notIn: terminalReturnStates },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingReturn) return { returnRequest: existingReturn, created: false };

      const publicNumber = `RET-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const created = await tx.returnRequest.create({
        data: {
          orderId: current.id,
          publicNumber,
          source: "issue",
          cause: current.issueReason || "unknown",
          reason: "refund",
          description: `Resolusi otomatis pesanan bermasalah (${current.issueReason || "unknown"})`,
          state: "awaiting_approval",
          refundAmount: current.grandTotal,
          items: {
            create: current.items.map(item => ({
              orderItemId: item.id,
              quantity: item.quantity,
            })),
          },
        },
      });
      await tx.order.update({
        where: { id: current.id },
        data: { fulfillmentState: "return_requested" },
      });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "return.resolved_initiated_refund",
          entityType: "return",
          entityId: created.id,
          after: {
            source: "issue",
            cause: current.issueReason,
            type: "refund",
          },
        },
      });
      await syncOrderRevenue(tx, current.id, String(admin.email));
      return { returnRequest: created, created: true };
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      redirect: `/admin/returns/${result.returnRequest.id}`,
    });
  } catch (error) {
    if (error instanceof ResolveConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Resolusi pesanan belum dapat disimpan" }, { status: 500 });
  }
}
