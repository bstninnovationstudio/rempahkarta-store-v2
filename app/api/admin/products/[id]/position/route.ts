import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { invalidateCatalogCache } from "@/lib/catalog";
import { hasExactAppOrigin } from "@/lib/security";

const inputSchema = z.object({ direction: z.enum(["up", "down"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Arah urutan tidak valid" }, { status: 400 });
  const { id } = await params;
  try {
    const changed = await prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
      if (!product) throw new Error("Produk tidak ditemukan");
      const rows = await tx.product.findMany({ where: product.status === "archived" ? { status: "archived" } : { status: { not: "archived" } }, select: { id: true, position: true }, orderBy: [{ position: "asc" }, { id: "asc" }] });
      const currentIndex = rows.findIndex(row => row.id === id);
      const targetIndex = currentIndex + (parsed.data.direction === "up" ? -1 : 1);
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) return false;
      const nextRows = [...rows];
      [nextRows[currentIndex], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[currentIndex]];
      await Promise.all(nextRows.map((row, index) => row.position === index + 1 ? null : tx.product.update({ where: { id: row.id }, data: { position: index + 1 } })));
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "product.reordered", entityType: "product", entityId: id, after: { direction: parsed.data.direction, position: targetIndex + 1 } } });
      return true;
    });
    if (changed) invalidateCatalogCache();
    return NextResponse.json({ success: true, changed });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Urutan produk gagal diperbarui" }, { status: 409 }); }
}
