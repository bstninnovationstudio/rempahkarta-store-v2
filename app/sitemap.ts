import type { MetadataRoute } from "next";
import { getPublicAppOrigin } from "@/lib/env";
import { getCatalogProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicAppOrigin();
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await getCatalogProducts();
    productEntries = products.map(product => ({
      url: new URL(`/products/${product.slug}`, base).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    // Sitemap publik tetap tersedia saat database sedang tidak dapat dijangkau.
  }
  return [
    { url: new URL("/", base).toString(), changeFrequency: "daily", priority: 1 },
    ...productEntries,
    { url: new URL("/pages/shipping", base).toString(), changeFrequency: "monthly", priority: 0.5 },
    { url: new URL("/pages/returns", base).toString(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
