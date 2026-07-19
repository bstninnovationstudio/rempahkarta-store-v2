import { z } from "zod";

const optionalDimension = z.number().int().positive().max(1000).nullable();

function marketplaceUrl(hosts: string[], label: string) {
  return z.string().trim().max(500).url(`${label} harus berupa URL valid`).refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:"
        && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }, `${label} wajib menggunakan HTTPS dan domain marketplace yang sesuai`).nullable().optional();
}

export const productVariantInputSchema = z.object({
  id: z.string().min(1).optional(),
  sku: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._/-]+$/, "SKU hanya boleh berisi huruf, angka, titik, garis miring, garis bawah, atau tanda minus"),
  option1Value: z.string().trim().min(1).max(80).nullable(),
  option2Value: z.string().trim().min(1).max(80).nullable(),
  price: z.number().int().positive().max(10_000_000_000),
  stock: z.number().int().nonnegative().max(1_000_000),
  weight: z.number().int().positive().max(1_000_000),
  length: optionalDimension,
  width: optionalDimension,
  height: optionalDimension,
  lowStockThreshold: z.number().int().nonnegative().max(1_000_000).default(5),
  active: z.boolean().default(true),
  imageKey: z.string().regex(/^\/uploads\/products\/[a-zA-Z0-9.-]+$/).nullable().optional(),
}).superRefine((value, context) => {
  const dimensions = [value.length, value.width, value.height];
  const filled = dimensions.filter(item => item !== null).length;
  if (filled !== 0 && filled !== 3) {
    context.addIssue({ code: "custom", path: ["length"], message: "Panjang, lebar, dan tinggi harus diisi lengkap atau dikosongkan seluruhnya" });
  }
});

export const productInputSchema = z.object({
  name: z.string().trim().min(3).max(180),
  categoryId: z.string().trim().min(1).nullable(),
  description: z.string().trim().min(10).max(20_000),
  status: z.enum(["draft", "active", "archived"]),
  hasVariants: z.boolean(),
  option1Name: z.string().trim().min(1).max(80).nullable(),
  option2Name: z.string().trim().min(1).max(80).nullable(),
  images: z.array(z.string().regex(/^\/uploads\/products\/[a-zA-Z0-9.-]+$/)).max(10),
  shopeeLink: marketplaceUrl(["shopee.co.id", "shopee.com"], "Tautan Shopee"),
  tiktokLink: marketplaceUrl(["tiktok.com"], "Tautan TikTok"),
  tokopediaLink: marketplaceUrl(["tokopedia.com"], "Tautan Tokopedia"),
  rating: z.number().min(0).max(5).default(0),
  sold: z.number().int().nonnegative().default(0),
  variants: z.array(productVariantInputSchema).min(1).max(100),
}).superRefine((value, context) => {
  if (!value.hasVariants) {
    if (value.variants.length !== 1) context.addIssue({ code: "custom", path: ["variants"], message: "Produk tanpa varian harus memiliki tepat satu detail penjualan" });
    if (value.option1Name || value.option2Name) context.addIssue({ code: "custom", path: ["option1Name"], message: "Nama tingkat harus kosong untuk produk tanpa varian" });
  } else {
    if (!value.option1Name) context.addIssue({ code: "custom", path: ["option1Name"], message: "Nama Tingkat I wajib diisi" });
    if (value.option2Name && value.variants.some(item => !item.option2Value)) context.addIssue({ code: "custom", path: ["variants"], message: "Nilai Tingkat II wajib lengkap" });
    if (value.variants.some(item => !item.option1Value)) context.addIssue({ code: "custom", path: ["variants"], message: "Nilai Tingkat I wajib lengkap" });
  }
  const skuSet = new Set(value.variants.map(item => item.sku.toLowerCase()));
  if (skuSet.size !== value.variants.length) context.addIssue({ code: "custom", path: ["variants"], message: "SKU pada produk tidak boleh duplikat" });
  const combinationSet = new Set(value.variants.map(item => `${item.option1Value ?? ""}\u0000${item.option2Value ?? ""}`.toLowerCase()));
  if (combinationSet.size !== value.variants.length) context.addIssue({ code: "custom", path: ["variants"], message: "Kombinasi variasi tidak boleh duplikat" });
});

export type ProductInput = z.infer<typeof productInputSchema>;

export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
}
