import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/product-admin";
import { invalidateCatalogCache } from "@/lib/catalog";

const schema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(255).nullable(), productIds: z.array(z.string().min(1)).max(2000) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data kategori tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const { id } = await params;
    const [category, productCount] = await Promise.all([
      prisma.productCategory.findUnique({ where: { id } }),
      prisma.product.count({ where: { id: { in: parsed.data.productIds } } }),
    ]);
    if (!category) return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    if (productCount !== parsed.data.productIds.length) return NextResponse.json({ error: "Salah satu produk tidak ditemukan" }, { status: 409 });
    const nextSlug = slugify(parsed.data.name);
    const conflict = await prisma.productCategory.findFirst({ where: { id: { not: id }, OR: [{ name: parsed.data.name }, { slug: nextSlug }] } });
    if (conflict) return NextResponse.json({ error: "Nama kategori sudah digunakan" }, { status: 409 });
    await prisma.$transaction(async tx => {
      await tx.productCategory.update({ where: { id }, data: { name: parsed.data.name, slug: nextSlug, description: parsed.data.description || null } });
      await tx.product.updateMany({ where: { categoryId: id, id: { notIn: parsed.data.productIds } }, data: { categoryId: null } });
      if (parsed.data.productIds.length) await tx.product.updateMany({ where: { id: { in: parsed.data.productIds } }, data: { categoryId: id, legacyCategory: null } });
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "category.updated", entityType: "category", entityId: id, before: { name: category.name }, after: { name: parsed.data.name, productCount: parsed.data.productIds.length } } });
    });
    invalidateCatalogCache();
    return NextResponse.json({ success: true });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Kategori gagal diperbarui" }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const category = await prisma.productCategory.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ success: true });
  await prisma.$transaction(async tx => {
    await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await tx.productCategory.delete({ where: { id } });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "category.deleted", entityType: "category", entityId: id, before: { name: category.name } } });
  });
  invalidateCatalogCache();
  return NextResponse.json({ success: true });
}
