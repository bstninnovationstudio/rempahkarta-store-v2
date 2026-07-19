import { products as demoProducts } from "@/lib/demo-data";
import type { Product, StoreVariant } from "@/lib/types";
import { revalidateTag, unstable_cache } from "next/cache";

export const CATALOG_CACHE_TAG = "storefront-catalog";

async function loadCatalogProducts(): Promise<Product[]> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum dikonfigurasi");
  const { prisma } = await import("@/lib/db");
  const rows = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { where: { active: true }, include: { inventory: true }, orderBy: { position: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.flatMap((product, index) => {
    const variants: StoreVariant[] = product.variants.map(variant => ({
      id: variant.id,
      sku: variant.sku,
      option1Value: variant.option1Value || undefined,
      option2Value: variant.option2Value || undefined,
      price: Number(variant.price),
      compareAt: variant.compareAt ? Number(variant.compareAt) : undefined,
      stock: variant.inventory.reduce((sum, level) => sum + Math.max(0, level.onHand - level.reserved - level.safetyStock), 0),
      weight: variant.weight,
      length: variant.length || undefined,
      width: variant.width || undefined,
      height: variant.height || undefined,
      imageKey: variant.imageKey || undefined,
    }));
    if (!variants.length) return [];
    const fallback = demoProducts[index % demoProducts.length];
    const mainImages = product.images.map(item => item.objectKey);
    const variantImages = product.variants
      .filter(v => v.active && v.imageKey)
      .map(v => v.imageKey as string);
    const allImages = [...mainImages, ...variantImages];
    const images = allImages.length ? allImages : [fallback.image];
    const cheapestVariant = variants.reduce((prev, curr) => prev.price < curr.price ? prev : curr, variants[0]);
    const first = variants[0];
    return [{
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category?.name || product.legacyCategory || "Tanpa kategori",
      price: cheapestVariant.price,
      compareAt: cheapestVariant.compareAt,
      image: images[0] || fallback.image,
      images,
      color: first.option1Value || "Produk tunggal",
      rating: Number(product.rating),
      sold: product.sold,
      description: product.description,
      material: "Lihat deskripsi produk",
      care: [
        "Simpan dalam suhu ruangan atau suhu dingin/lemari es",
        "Jangan terpapar sinar matahari secara langsung dalam jangka waktu yang cukup lama",
        "Simpan dan tutup rapat (jika sudah terbuka) dan tempatkan pada posisi yang aman"
      ],
      sizes: [...new Set(variants.map(item => item.option1Value).filter((item): item is string => Boolean(item)))],
      stock: variants.reduce((sum, item) => sum + item.stock, 0),
      hasVariants: product.hasVariants,
      option1Name: product.option1Name || undefined,
      option2Name: product.option2Name || undefined,
      shopeeLink: product.shopeeLink || undefined,
      tiktokLink: product.tiktokLink || undefined,
      tokopediaLink: product.tokopediaLink || undefined,
      variants,
    }];
  });
}

const getCachedCatalogProducts = unstable_cache(
  loadCatalogProducts,
  ["storefront-catalog-v1"],
  { revalidate: 30 * 60, tags: [CATALOG_CACHE_TAG] },
);

export async function getCatalogProducts(): Promise<Product[]> {
  return getCachedCatalogProducts();
}

export function invalidateCatalogCache() {
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
}
