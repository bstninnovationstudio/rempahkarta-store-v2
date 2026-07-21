import { z } from "zod";

const optionalPositiveMoney = z.number().int().positive().max(100_000_000).nullable().optional();
const optionalPositiveLimit = z.number().int().positive().max(1_000_000).nullable().optional();

export const voucherInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5_000).nullable().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,50}$/),
  status: z.enum(["ACTIVE", "PAUSE", "FINISH"]),
  available: z.enum(["public", "private"]),
  mode: z.enum(["NOMINAL", "PERCENTAGE"]),
  discountValue: z.number().int().positive().max(100_000_000),
  minPurchase: optionalPositiveMoney,
  maxDiscount: optionalPositiveMoney,
  dailyLimit: optionalPositiveLimit,
  totalLimit: optionalPositiveLimit,
  userLimit: optionalPositiveLimit,
  startAt: z.string().trim().max(40).nullable().optional(),
  endAt: z.string().trim().max(40).nullable().optional(),
  target: z.enum(["TOTAL", "PRODUCT_SUBTOTAL", "SHIPPING"]),
}).superRefine((value, context) => {
  if (value.mode === "PERCENTAGE" && value.discountValue > 100) context.addIssue({ code: "custom", path: ["discountValue"], message: "Diskon persen maksimal 100" });
  const startAt = parseWibDate(value.startAt);
  const endAt = parseWibDate(value.endAt);
  if (startAt && endAt && startAt >= endAt) context.addIssue({ code: "custom", path: ["endAt"], message: "Waktu berakhir harus setelah mulai berlaku" });
});

export function parseWibDate(value: string | null | undefined) {
  if (!value) return null;
  const localWithSeconds = value.includes("T") && value.split("T")[1].split(":").length === 2 ? `${value}:00` : value;
  const withZone = /(?:Z|[+-]\d\d:\d\d)$/.test(localWithSeconds) ? localWithSeconds : `${localWithSeconds}+07:00`;
  const result = new Date(withZone);
  if (Number.isNaN(result.getTime())) throw new Error("Format waktu voucher tidak valid");
  return result;
}

export function voucherData(input: z.infer<typeof voucherInputSchema>) {
  return {
    name: input.name,
    description: input.description?.trim() || null,
    code: input.code,
    status: input.status,
    available: input.available,
    mode: input.mode,
    discountValue: BigInt(input.discountValue),
    minPurchase: input.minPurchase ? BigInt(input.minPurchase) : null,
    maxDiscount: input.maxDiscount ? BigInt(input.maxDiscount) : null,
    dailyLimit: input.dailyLimit || null,
    totalLimit: input.totalLimit || null,
    userLimit: input.userLimit || null,
    startAt: parseWibDate(input.startAt),
    endAt: parseWibDate(input.endAt),
    target: input.target,
  };
}

export function serializeVoucher<T extends { discountValue: bigint; minPurchase: bigint | null; maxDiscount: bigint | null }>(voucher: T) {
  return { ...voucher, discountValue: Number(voucher.discountValue), minPurchase: voucher.minPurchase === null ? null : Number(voucher.minPurchase), maxDiscount: voucher.maxDiscount === null ? null : Number(voucher.maxDiscount) };
}
