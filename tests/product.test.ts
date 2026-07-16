import assert from "node:assert/strict";
import test from "node:test";
import { productInputSchema } from "../lib/product-admin";

const baseVariant = { sku: "RMP-KMN-A-100", option1Value: "A", option2Value: "100 g", price: 29000, stock: 10, weight: 120, length: null, width: null, height: null, lowStockThreshold: 5, active: true };

test("produk menerima variasi bertingkat maksimal dua tingkat", () => {
  const result = productInputSchema.safeParse({ name: "Kayu Manis Premium", categoryId: null, description: "Kayu manis pilihan berkualitas.", status: "active", hasVariants: true, option1Name: "Kualitas", option2Name: "Berat", images: [], variants: [baseVariant, { ...baseVariant, sku: "RMP-KMN-A-250", option2Value: "250 g" }, { ...baseVariant, sku: "RMP-KMN-B-100", option1Value: "B" }] });
  assert.equal(result.success, true);
});

test("produk tanpa varian harus tepat satu detail umum", () => {
  const result = productInputSchema.safeParse({ name: "Cengkeh Utuh", categoryId: null, description: "Cengkeh utuh beraroma kuat.", status: "active", hasVariants: false, option1Name: null, option2Name: null, images: [], variants: [{ ...baseVariant, option1Value: null, option2Value: null }, { ...baseVariant, sku: "RMP-CGK-2", option1Value: null, option2Value: null }] });
  assert.equal(result.success, false);
});

test("dimensi paket wajib lengkap atau seluruhnya kosong", () => {
  const result = productInputSchema.safeParse({ name: "Cengkeh Utuh", categoryId: null, description: "Cengkeh utuh beraroma kuat.", status: "active", hasVariants: false, option1Name: null, option2Name: null, images: [], variants: [{ ...baseVariant, option1Value: null, option2Value: null, length: 10 }] });
  assert.equal(result.success, false);
});

test("kombinasi variasi duplikat ditolak", () => {
  const result = productInputSchema.safeParse({ name: "Kayu Manis Premium", categoryId: null, description: "Kayu manis pilihan berkualitas.", status: "active", hasVariants: true, option1Name: "Kualitas", option2Name: "Berat", images: [], variants: [baseVariant, { ...baseVariant, sku: "RMP-KMN-DUPLIKAT" }] });
  assert.equal(result.success, false);
});
