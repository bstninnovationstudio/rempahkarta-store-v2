import type { BstnItem } from "@/lib/adapters/bstn";

type DiscountableLine = BstnItem & { quantity: number };

function reduceLine(line: DiscountableLine, reduction: number): BstnItem[] {
  if (reduction <= 0 || line.price <= 0) return [line];
  const total = line.price * line.quantity;
  const safeReduction = Math.min(reduction, total);
  const zeroQuantity = Math.floor(safeReduction / line.price);
  const remainder = safeReduction - zeroQuantity * line.price;
  const result: BstnItem[] = [];
  if (zeroQuantity > 0) result.push({ ...line, id: `${line.id || "ITEM"}-discounted`, price: 0, quantity: zeroQuantity });
  if (remainder > 0) result.push({ ...line, id: `${line.id || "ITEM"}-adjusted`, price: line.price - remainder, quantity: 1 });
  const untouched = line.quantity - zeroQuantity - (remainder > 0 ? 1 : 0);
  if (untouched > 0) result.push({ ...line, quantity: untouched });
  return result;
}

/** BSTN only accepts non-negative item prices; embed the discount into positive lines. */
export function buildBstnItems(input: {
  productItems: DiscountableLine[];
  shippingItem: DiscountableLine;
  discountAmount: number;
  target: "TOTAL" | "PRODUCT_SUBTOTAL" | "SHIPPING" | null;
  serviceFee: number;
}) {
  let remaining = Math.max(0, Math.trunc(input.discountAmount));
  const products = input.productItems;
  const preferred = input.target === "SHIPPING" ? [input.shippingItem] : input.target === "PRODUCT_SUBTOTAL" ? products : [...products, input.shippingItem];
  const reductions = new Map<DiscountableLine, number>();
  for (const line of preferred) {
    if (!remaining) break;
    const reduction = Math.min(remaining, line.price * line.quantity);
    reductions.set(line, reduction);
    remaining -= reduction;
  }
  if (remaining > 0) throw new Error("Diskon voucher tidak dapat dipetakan ke item pembayaran");
  const result = [...products.flatMap(line => reduceLine(line, reductions.get(line) || 0)), ...reduceLine(input.shippingItem, reductions.get(input.shippingItem) || 0)];
  if (input.serviceFee > 0) result.push({ id: "SERVICE_FEE", name: "Biaya Layanan", price: input.serviceFee, quantity: 1 });
  return result;
}
