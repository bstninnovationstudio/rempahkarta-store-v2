import { prisma } from "@/lib/db";
import type { ProductInput } from "@/lib/product-admin";
import { slugify } from "@/lib/product-admin";

function variantName(productName: string, option1: string | null, option2: string | null) {
  return [productName, option1, option2].filter(Boolean).join(" / ");
}

export async function saveProduct(input: ProductInput, adminEmail: string, productId?: string) {
  const [warehouse, category, existingProduct] = await Promise.all([
    prisma.warehouse.findFirst({ where: { isDefault: true } }),
    input.categoryId ? prisma.productCategory.findUnique({ where: { id: input.categoryId } }) : null,
    productId ? prisma.product.findUnique({ where: { id: productId }, include: { variants: { include: { inventory: true } } } }) : null,
  ]);
  if (!warehouse) throw new Error("Gudang default belum tersedia");
  if (input.categoryId && !category) throw new Error("Kategori tidak ditemukan");
  if (productId && !existingProduct) throw new Error("Produk tidak ditemukan");

  const inputIds = input.variants.flatMap(item => item.id ? [item.id] : []);
  if (existingProduct && inputIds.some(id => !existingProduct.variants.some(item => item.id === id))) {
    throw new Error("Varian tidak sesuai dengan produk");
  }
  const skuConflict = await prisma.productVariant.findFirst({
    where: {
      sku: { in: input.variants.map(item => item.sku) },
      ...(productId ? { productId: { not: productId } } : {}),
    },
    select: { sku: true },
  });
  if (skuConflict) throw new Error(`SKU ${skuConflict.sku} sudah digunakan`);

  let slug = existingProduct?.slug;
  if (!slug) {
    const base = slugify(input.name) || `produk-${Date.now().toString(36)}`;
    slug = await prisma.product.findUnique({ where: { slug: base } }) ? `${base}-${Date.now().toString(36)}` : base;
  }

  return prisma.$transaction(async tx => {
    const product = existingProduct
      ? await tx.product.update({
          where: { id: existingProduct.id },
          data: {
            name: input.name,
            description: input.description,
            status: input.status,
            categoryId: input.categoryId,
            legacyCategory: null,
            hasVariants: input.hasVariants,
            option1Name: input.hasVariants ? input.option1Name : null,
            option2Name: input.hasVariants ? input.option2Name : null,
            shopeeLink: input.shopeeLink || null,
            tiktokLink: input.tiktokLink || null,
            tokopediaLink: input.tokopediaLink || null,
            rating: input.rating,
            sold: input.sold,
          },
        })
      : await tx.product.create({
          data: {
            slug,
            name: input.name,
            description: input.description,
            status: input.status,
            categoryId: input.categoryId,
            hasVariants: input.hasVariants,
            option1Name: input.hasVariants ? input.option1Name : null,
            option2Name: input.hasVariants ? input.option2Name : null,
            shopeeLink: input.shopeeLink || null,
            tiktokLink: input.tiktokLink || null,
            tokopediaLink: input.tokopediaLink || null,
            rating: input.rating,
            sold: input.sold,
          },
        });

    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (input.images.length) {
      await tx.productImage.createMany({
        data: input.images.map((objectKey, position) => ({
          productId: product.id,
          objectKey,
          alt: `${input.name} ${position + 1}`,
          position,
          primary: position === 0,
        })),
      });
    }

    const retainedIds: string[] = [];
    for (const [position, item] of input.variants.entries()) {
      const common = {
        sku: item.sku,
        name: variantName(input.name, input.hasVariants ? item.option1Value : null, input.hasVariants ? item.option2Value : null),
        option1Value: input.hasVariants ? item.option1Value : null,
        option2Value: input.hasVariants ? item.option2Value : null,
        price: BigInt(item.price),
        weight: item.weight,
        length: item.length,
        width: item.width,
        height: item.height,
        lowStockThreshold: item.lowStockThreshold,
        position,
        active: item.active,
        imageKey: item.imageKey,
      };
      if (item.id) {
        const current = existingProduct?.variants.find(candidate => candidate.id === item.id);
        if (!current) throw new Error("Varian tidak ditemukan");
        const level = current.inventory.find(candidate => candidate.warehouseId === warehouse.id);
        if (level && item.stock < level.reserved) throw new Error(`Stok ${item.sku} tidak boleh lebih kecil dari stok yang sedang direservasi (${level.reserved})`);
        await tx.productVariant.update({ where: { id: item.id }, data: common });
        if (level) {
          const delta = item.stock - level.onHand;
          if (delta !== 0) {
            const updated = await tx.inventoryLevel.updateMany({
              where: { id: level.id, version: level.version },
              data: { onHand: item.stock, version: { increment: 1 } },
            });
            if (updated.count !== 1) throw new Error(`Stok ${item.sku} berubah. Muat ulang halaman lalu coba kembali.`);
            await tx.inventoryMovement.create({ data: { variantId: item.id, warehouseId: warehouse.id, type: "admin_set_stock", quantityDelta: delta, referenceType: "product", referenceId: product.id, actorId: adminEmail, dedupeKey: `admin_set_stock:${item.id}:${crypto.randomUUID()}` } });
          }
        } else {
          await tx.inventoryLevel.create({ data: { variantId: item.id, warehouseId: warehouse.id, onHand: item.stock } });
        }
        retainedIds.push(item.id);
      } else {
        const variant = await tx.productVariant.create({ data: { productId: product.id, ...common, inventory: { create: { warehouseId: warehouse.id, onHand: item.stock } } } });
        retainedIds.push(variant.id);
        if (item.stock > 0) await tx.inventoryMovement.create({ data: { variantId: variant.id, warehouseId: warehouse.id, type: "initial_stock", quantityDelta: item.stock, referenceType: "product", referenceId: product.id, actorId: adminEmail, dedupeKey: `initial_stock:${variant.id}` } });
      }
    }
    await tx.productVariant.updateMany({ where: { productId: product.id, id: { notIn: retainedIds } }, data: { active: false } });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: adminEmail, action: existingProduct ? "product.updated" : "product.created", entityType: "product", entityId: product.id, after: { name: product.name, slug: product.slug, status: product.status, hasVariants: product.hasVariants, variantCount: input.variants.length, imageCount: input.images.length, categoryId: input.categoryId } } });
    return product;
  });
}
