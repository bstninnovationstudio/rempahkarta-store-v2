import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productInputSchema } from "@/lib/product-admin";
import { saveProduct } from "@/lib/product-service";
import { invalidateCatalogCache } from "@/lib/catalog";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = productInputSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Data produk tidak valid", details: body.error.flatten() }, { status: 400 });
    const { id } = await params;
    const product = await saveProduct(body.data, String(admin.email), id);
    return NextResponse.json({ success: true, id: product.id, slug: product.slug });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Produk gagal diperbarui";
    const status = /tidak ditemukan/i.test(message) ? 404 : /sudah digunakan|tidak boleh|berubah/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, variants: { select: { id: true } } },
    });
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });

    const variantIds = product.variants.map(item => item.id);
    const [orderItemCount, movementCount, cartItemCount] = await Promise.all([
      prisma.orderItem.count({ where: { variantId: { in: variantIds } } }),
      prisma.inventoryMovement.count({ where: { variantId: { in: variantIds } } }),
      prisma.cartItem.count({ where: { OR: [{ productId: id }, { variantId: { in: variantIds } }] } }),
    ]);
    const requiresArchive = orderItemCount > 0 || movementCount > 0 || cartItemCount > 0;

    await prisma.$transaction(async tx => {
      if (requiresArchive) {
        await tx.product.update({ where: { id }, data: { status: "archived" } });
        await tx.productVariant.updateMany({ where: { productId: id }, data: { active: false } });
      } else {
        await tx.inventoryLevel.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      }
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: requiresArchive ? "product.archived" : "product.deleted",
          entityType: "product",
          entityId: id,
          before: { name: product.name, orderItemCount, movementCount, cartItemCount },
        },
      });
    });
    invalidateCatalogCache();
    return NextResponse.json({ success: true, archived: requiresArchive, message: requiresArchive ? "Produk diarsipkan karena memiliki data historis" : "Produk berhasil dihapus" });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Produk gagal dihapus" }, { status: 500 });
  }
}
