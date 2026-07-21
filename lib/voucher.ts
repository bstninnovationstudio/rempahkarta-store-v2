import type { Prisma, Voucher, VoucherTarget } from "@prisma/client";

type VoucherClient = Prisma.TransactionClient;
export type VoucherAmounts = { subtotal: bigint; shippingFee: bigint };
export type VoucherEvaluation = { voucher: Voucher; discountAmount: bigint; baseAmount: bigint };

export function normalizeVoucherCode(value: string) {
  return value.trim().toUpperCase();
}

export function voucherTargetAmount(target: VoucherTarget, amounts: VoucherAmounts) {
  if (target === "PRODUCT_SUBTOTAL") return amounts.subtotal;
  if (target === "SHIPPING") return amounts.shippingFee;
  return amounts.subtotal + amounts.shippingFee;
}

export function calculateVoucherDiscount(voucher: Pick<Voucher, "mode" | "discountValue" | "maxDiscount" | "target">, amounts: VoucherAmounts) {
  const baseAmount = voucherTargetAmount(voucher.target, amounts);
  const raw = voucher.mode === "PERCENTAGE"
    ? (baseAmount * voucher.discountValue) / BigInt(100)
    : voucher.discountValue;
  const capped = voucher.maxDiscount !== null && voucher.maxDiscount > BigInt(0) && raw > voucher.maxDiscount ? voucher.maxDiscount : raw;
  return { baseAmount, discountAmount: capped > baseAmount ? baseAmount : capped };
}

/** WIB day boundaries represented as UTC dates. */
export function wibDayRange(now = new Date()) {
  const jakarta = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => jakarta.find(item => item.type === type)?.value || "01";
  const start = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

async function finishIfTerminal(tx: VoucherClient, voucher: Voucher, now: Date) {
  if (voucher.status !== "ACTIVE") return voucher;
  if ((voucher.endAt && voucher.endAt <= now) || (voucher.totalLimit !== null && voucher.totalUsage >= voucher.totalLimit)) {
    await tx.voucher.updateMany({ where: { id: voucher.id, status: "ACTIVE" }, data: { status: "FINISH" } });
    return { ...voucher, status: "FINISH" as const };
  }
  return voucher;
}

export async function evaluateVoucher(tx: VoucherClient, input: { code: string; userId: string; amounts: VoucherAmounts; now?: Date }) : Promise<VoucherEvaluation> {
  const now = input.now || new Date();
  const code = normalizeVoucherCode(input.code);
  const found = await tx.voucher.findUnique({ where: { code } });
  if (!found) throw new Error("Kode promo tidak ditemukan");
  const voucher = await finishIfTerminal(tx, found, now);
  if (voucher.status !== "ACTIVE") throw new Error(voucher.status === "PAUSE" ? "Promo sedang dijeda" : "Promo telah selesai");
  if (voucher.startAt && now < voucher.startAt) throw new Error("Promo belum dimulai");
  if (voucher.endAt && now >= voucher.endAt) throw new Error("Promo telah berakhir");
  if (voucher.totalLimit !== null && voucher.totalUsage >= voucher.totalLimit) throw new Error("Kuota voucher sudah habis");
  const { baseAmount, discountAmount } = calculateVoucherDiscount(voucher, input.amounts);
  if (voucher.minPurchase !== null && baseAmount < voucher.minPurchase) throw new Error("Minimal nominal pembelian belum terpenuhi");
  if (discountAmount <= BigInt(0)) throw new Error("Voucher tidak dapat digunakan pada pesanan ini");
  const [dailyUsage, userUsage] = await Promise.all([
    voucher.dailyLimit === null ? Promise.resolve(0) : tx.voucherUsage.count({ where: { voucherId: voucher.id, createdAt: { gte: wibDayRange(now).start, lt: wibDayRange(now).end } } }),
    voucher.userLimit === null ? Promise.resolve(0) : tx.voucherUsage.count({ where: { voucherId: voucher.id, userId: input.userId } }),
  ]);
  if (voucher.dailyLimit !== null && dailyUsage >= voucher.dailyLimit) throw new Error("Kuota harian voucher sudah habis");
  if (voucher.userLimit !== null && userUsage >= voucher.userLimit) throw new Error("Batas penggunaan voucher per akun telah tercapai");
  return { voucher, discountAmount, baseAmount };
}

export async function finishExpiredVouchers() {
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  const result = await prisma.voucher.updateMany({ where: { status: "ACTIVE", endAt: { lte: now } }, data: { status: "FINISH" } });
  const candidates = await prisma.voucher.findMany({ where: { status: "ACTIVE", totalLimit: { not: null } }, select: { id: true, totalLimit: true, totalUsage: true } });
  const exhausted = candidates.filter(item => item.totalLimit !== null && item.totalUsage >= item.totalLimit).map(item => item.id);
  if (exhausted.length) await prisma.voucher.updateMany({ where: { id: { in: exhausted }, status: "ACTIVE" }, data: { status: "FINISH" } });
  return result.count + exhausted.length;
}

export async function getPublicVouchers() {
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  await prisma.voucher.updateMany({ where: { status: "ACTIVE", endAt: { lte: now } }, data: { status: "FINISH" } });
  const rows = await prisma.voucher.findMany({
    where: { available: "public", status: "ACTIVE", AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gt: now } }] }] },
    orderBy: [{ endAt: "asc" }, { createdAt: "desc" }], take: 12,
    select: { code: true, name: true, description: true, mode: true, discountValue: true, minPurchase: true, maxDiscount: true, endAt: true, target: true },
  });
  return rows.map(item => ({ ...item, discountValue: Number(item.discountValue), minPurchase: item.minPurchase === null ? null : Number(item.minPurchase), maxDiscount: item.maxDiscount === null ? null : Number(item.maxDiscount) }));
}
