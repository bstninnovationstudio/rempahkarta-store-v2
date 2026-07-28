import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commitOrderReservation } from "@/lib/inventory";
import { invalidateCatalogCache } from "@/lib/catalog";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({ state: z.enum(["processing", "packed"]) });
class TransitionConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "admin:order-transition", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "State tidak valid" }, { status: 400 });
  const { number } = await params;
  const found = await prisma.order.findUnique({ where: { publicNumber: number }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${found.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({ where: { id: found.id } });
      if (current.fulfillmentState === body.data.state) return { changed: false, state: current.fulfillmentState };
      const expected = body.data.state === "processing" ? "awaiting_processing" : "processing";
      if (current.fulfillmentState !== expected) {
        throw new TransitionConflictError(`Tidak dapat mengubah ${current.fulfillmentState} ke ${body.data.state}`);
      }
      if (body.data.state === "packed") await commitOrderReservation(tx, current.id);
      const changed = await tx.order.updateMany({
        where: { id: current.id, fulfillmentState: expected },
        data: { fulfillmentState: body.data.state },
      });
      if (changed.count !== 1) throw new TransitionConflictError("Status pesanan berubah. Muat ulang halaman.");
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: `order.${body.data.state}`,
          entityType: "order",
          entityId: current.id,
          before: { fulfillmentState: current.fulfillmentState },
          after: { fulfillmentState: body.data.state },
        },
      });
      return { changed: true, state: body.data.state };
    });
    if (result.changed && result.state === "packed") invalidateCatalogCache();
    return NextResponse.json({ success: true, state: result.state });
  } catch (error) {
    if (error instanceof TransitionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Status pesanan belum dapat diubah" }, { status: 500 });
  }
}
