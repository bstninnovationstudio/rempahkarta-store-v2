import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncOrderRevenue } from "@/lib/finance";

const schema = z.object({
  type: z.enum(["refund", "finish"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
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
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: { items: true },
  });

  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  if (body.data.type === "finish") {
    // Transition order to finished and clear issueOrder flag
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          issueOrder: false,
          fulfillmentState: "finished",
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "order.issue_resolved_finish",
          entityType: "order",
          entityId: order.id,
          after: { fulfillmentState: "finished" },
        },
      });
      await syncOrderRevenue(tx, order.id, String(admin.email));
    });
    return NextResponse.json({ success: true });
  }

  // For refund or return resolutions: create a ReturnRequest with source: "issue"
  const returnRequest = await prisma.$transaction(async (tx) => {
    const publicNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
    const created = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        publicNumber,
        source: "issue",
        cause: order.issueReason || "unknown",
        reason: body.data.type, // "refund" or "return"
        description: `Resolusi otomatis pesanan bermasalah (${order.issueReason || "unknown"})`,
        state: "awaiting_approval",
        refundAmount: order.grandTotal,
        items: {
          create: order.items.map((item) => ({
            orderItemId: item.id,
            quantity: item.quantity,
          })),
        },
      },
    });

    // Update order's fulfillment state to return_requested
    await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentState: "return_requested",
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: String(admin.email),
        action: `return.resolved_initiated_${body.data.type}`,
        entityType: "return",
        entityId: created.id,
        after: {
          source: "issue",
          cause: order.issueReason,
          type: body.data.type,
        },
      },
    });

    await syncOrderRevenue(tx, order.id, String(admin.email));

    return created;
  });

  return NextResponse.json({
    success: true,
    redirect: `/admin/returns/${returnRequest.id}`,
  });
}
