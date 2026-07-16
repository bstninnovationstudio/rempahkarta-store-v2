import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commitOrderReservation } from "@/lib/inventory";

const schema = z.object({ state: z.enum(["processing", "packed"]) });

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "State tidak valid" }, { status: 400 });
  const { number } = await params;
  const order = await prisma.order.findUnique({ where: { publicNumber: number } });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  const allowed = body.data.state === "processing"
    ? order.fulfillmentState === "awaiting_processing"
    : order.fulfillmentState === "processing";
  if (!allowed) {
    if (order.fulfillmentState === body.data.state) return NextResponse.json({ success: true, state: order.fulfillmentState });
    return NextResponse.json({ error: `Tidak dapat mengubah ${order.fulfillmentState} ke ${body.data.state}` }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    if (body.data.state === "packed") await commitOrderReservation(tx, order.id);
    await tx.order.update({ where: { id: order.id }, data: { fulfillmentState: body.data.state } });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: String(admin.email),
        action: `order.${body.data.state}`,
        entityType: "order",
        entityId: order.id,
        before: { fulfillmentState: order.fulfillmentState },
        after: { fulfillmentState: body.data.state },
      },
    });
  });
  return NextResponse.json({ success: true, state: body.data.state });
}
