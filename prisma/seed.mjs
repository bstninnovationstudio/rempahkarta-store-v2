import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const categories = [
  { id: "cat_rempah_utuh", slug: "rempah-utuh", name: "Rempah Utuh", description: "Rempah pilihan dalam bentuk utuh." },
  { id: "cat_rempah_bubuk", slug: "rempah-bubuk", name: "Rempah Bubuk", description: "Rempah siap pakai yang digiling segar." },
];
const products = [
  { id: "prd_shinan", slug: "kayu-manis-premium", name: "Kayu Manis Premium", categoryId: "cat_rempah_utuh", description: "Kayu manis beraroma hangat, dipilih dan dikemas untuk menjaga kesegarannya.", hasVariants: true, option1Name: "Kualitas", option2Name: "Berat Bersih", variants: [
    { id: "var_shinan_white_m", sku: "RMP-KMN-RGL-100", option1Value: "Regular", option2Value: "100 g", price: 29000, weight: 120, stock: 20 },
    { id: "var_kmn_rgl_250", sku: "RMP-KMN-RGL-250", option1Value: "Regular", option2Value: "250 g", price: 59000, weight: 280, stock: 15 },
    { id: "var_kmn_prm_100", sku: "RMP-KMN-PRM-100", option1Value: "Premium", option2Value: "100 g", price: 39000, weight: 120, stock: 12 },
    { id: "var_kmn_prm_250", sku: "RMP-KMN-PRM-250", option1Value: "Premium", option2Value: "250 g", price: 79000, weight: 280, stock: 8 },
  ] },
  { id: "prd_aruna", slug: "cengkeh-utuh", name: "Cengkeh Utuh", categoryId: "cat_rempah_utuh", description: "Cengkeh utuh dengan aroma tajam dan warna alami untuk masakan serta minuman rempah.", hasVariants: false, option1Name: null, option2Name: null, variants: [
    { id: "var_aruna_sky_m", sku: "RMP-CGK-100", option1Value: null, option2Value: null, price: 35000, weight: 120, stock: 16 },
  ] },
  { id: "prd_nawasena", slug: "kapulaga-hijau", name: "Kapulaga Hijau", categoryId: "cat_rempah_utuh", description: "Kapulaga hijau pilihan dengan karakter segar untuk racikan minuman dan masakan.", hasVariants: true, option1Name: "Berat Bersih", option2Name: null, variants: [
    { id: "var_nawasena_navy_m", sku: "RMP-KPL-50", option1Value: "50 g", option2Value: null, price: 42000, weight: 70, stock: 10 },
    { id: "var_kpl_100", sku: "RMP-KPL-100", option1Value: "100 g", option2Value: null, price: 79000, weight: 120, stock: 7 },
  ] },
];

await db.warehouse.upsert({ where: { id: "wh_main" }, update: { name: process.env.WAREHOUSE_NAME || "Gudang Utama REMPAHKARTA", contactName: process.env.WAREHOUSE_CONTACT_NAME || "REMPAHKARTA", contactPhone: process.env.WAREHOUSE_CONTACT_PHONE || "081200000000", address: process.env.WAREHOUSE_ADDRESS || "Alamat lengkap gudang", postalCode: process.env.WAREHOUSE_POSTAL_CODE || "55664", areaId: process.env.WAREHOUSE_AREA_ID && !process.env.WAREHOUSE_AREA_ID.startsWith("replace_") ? process.env.WAREHOUSE_AREA_ID : null, isDefault: true }, create: { id: "wh_main", name: process.env.WAREHOUSE_NAME || "Gudang Utama REMPAHKARTA", contactName: process.env.WAREHOUSE_CONTACT_NAME || "REMPAHKARTA", contactPhone: process.env.WAREHOUSE_CONTACT_PHONE || "081200000000", address: process.env.WAREHOUSE_ADDRESS || "Alamat lengkap gudang", postalCode: process.env.WAREHOUSE_POSTAL_CODE || "55664", areaId: process.env.WAREHOUSE_AREA_ID && !process.env.WAREHOUSE_AREA_ID.startsWith("replace_") ? process.env.WAREHOUSE_AREA_ID : null, isDefault: true } });
for (const category of categories) await db.productCategory.upsert({ where: { id: category.id }, update: category, create: category });
const legacyProducts = await db.product.findMany({ where: { categoryId: null, legacyCategory: { not: null } }, select: { id: true, legacyCategory: true } });
for (const product of legacyProducts) {
  const name = product.legacyCategory?.trim();
  if (!name) continue;
  const existing = await db.productCategory.findUnique({ where: { name } });
  const category = existing || await db.productCategory.create({ data: { name, slug: `${name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100)}-${crypto.randomUUID().slice(0, 5)}` } });
  await db.product.update({ where: { id: product.id }, data: { categoryId: category.id, legacyCategory: null } });
}
for (const item of products) {
  await db.product.upsert({ where: { id: item.id }, update: { slug: item.slug, name: item.name, description: item.description, categoryId: item.categoryId, legacyCategory: null, hasVariants: item.hasVariants, option1Name: item.option1Name, option2Name: item.option2Name, status: "active" }, create: { id: item.id, slug: item.slug, name: item.name, description: item.description, categoryId: item.categoryId, hasVariants: item.hasVariants, option1Name: item.option1Name, option2Name: item.option2Name, status: "active" } });
  const retained = [];
  for (const [position, variant] of item.variants.entries()) {
    retained.push(variant.id);
    await db.productVariant.upsert({ where: { id: variant.id }, update: { sku: variant.sku, name: [item.name, variant.option1Value, variant.option2Value].filter(Boolean).join(" / "), option1Value: variant.option1Value, option2Value: variant.option2Value, color: null, size: null, price: BigInt(variant.price), weight: variant.weight, length: null, width: null, height: null, lowStockThreshold: 5, position, active: true }, create: { id: variant.id, productId: item.id, sku: variant.sku, name: [item.name, variant.option1Value, variant.option2Value].filter(Boolean).join(" / "), option1Value: variant.option1Value, option2Value: variant.option2Value, price: BigInt(variant.price), weight: variant.weight, lowStockThreshold: 5, position, active: true } });
    await db.inventoryLevel.upsert({ where: { variantId_warehouseId: { variantId: variant.id, warehouseId: "wh_main" } }, update: {}, create: { variantId: variant.id, warehouseId: "wh_main", onHand: variant.stock, reserved: 0, safetyStock: 0 } });
  }
  await db.productVariant.updateMany({ where: { productId: item.id, id: { notIn: retained } }, data: { active: false } });
}
console.log("Seed REMPAHKARTA selesai");
await db.$disconnect();
