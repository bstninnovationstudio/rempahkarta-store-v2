import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ delta: z.number().int().min(-1_000_000).max(1_000_000).refine(value => value !== 0), reason: z.string().trim().min(3).max(255) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Penyesuaian tidak valid", details: body.error.flatten() }, { status: 400 });
    const { id } = await params;
    const level = await prisma.inventoryLevel.findUnique({ where: { id } });
    if (!level) return NextResponse.json({ error: "Inventori tidak ditemukan" }, { status: 404 });
    const nextOnHand = level.onHand + body.data.delta;
    if (nextOnHand < level.reserved) return NextResponse.json({ error: `Stok fisik tidak boleh lebih kecil dari ${level.reserved} unit yang sedang direservasi` }, { status: 409 });
    await prisma.$transaction(async tx => {
      const updated = await tx.inventoryLevel.updateMany({ where: { id, version: level.version }, data: { onHand: nextOnHand, version: { increment: 1 } } });
      if (updated.count !== 1) throw new Error("Stok berubah. Muat ulang lalu coba kembali.");
      await tx.inventoryMovement.create({ data: { variantId: level.variantId, warehouseId: level.warehouseId, type: "manual_adjustment", quantityDelta: body.data.delta, referenceType: "inventory", referenceId: id, reason: body.data.reason, actorId: String(admin.email), dedupeKey: `manual_adjustment:${id}:${crypto.randomUUID()}` } });
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "inventory.adjusted", entityType: "inventory", entityId: id, before: { onHand: level.onHand }, after: { onHand: nextOnHand, reason: body.data.reason } } });
    });
    return NextResponse.json({ success: true, onHand: nextOnHand });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Penyesuaian stok gagal" }, { status: 409 }); }
}
