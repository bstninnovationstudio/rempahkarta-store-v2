import { getDefaultServiceFee, getBstnQrisFeeRate } from "@/lib/env";

export type FeeBreakdown = {
  /** Subtotal barang + Ongkos kirim */
  baseAmount: number;
  /** Fixed fee toko (misal Rp 500) */
  fixedFee: number;
  /** Estimasi fee QRIS untuk membentuk total sebelum respons provider */
  estimatedQrisFee: number;
  /** Nominal acuan yang dikirim ke API BSTN (baseAmount + fixedFee) */
  bstnAmount: number;
  /** Total Biaya Layanan yang ditampilkan di UI (termasuk kompensasi QRIS 0.7%) */
  serviceFee: number;
  /** Total Tagihan Final (sama persis dengan nominal QRIS BSTN) */
  grandTotal: number;
};

/**
 * Menghitung Biaya Layanan terpadu dan Total Tagihan Final.
 * @param baseAmount Total subtotal produk + ongkos kirim (sebelum biaya layanan)
 * @param fixedFee Optional fixed fee toko (default: 500 dari ENV)
 * @param rate Optional rate gross-up BSTN (default: 0.007 dari ENV)
 */
export function calculateServiceFee(
  baseAmount: number,
  fixedFee = getDefaultServiceFee(),
  rate = getBstnQrisFeeRate(),
): FeeBreakdown {
  const safeBase = Math.max(0, Math.round(baseAmount));
  const safeFixed = Math.max(0, Math.round(fixedFee));
  const safeRate = Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : 0.007;

  const bstnAmount = safeBase + safeFixed;
  const grandTotal = Math.ceil(bstnAmount / (1 - safeRate));
  const serviceFee = grandTotal - safeBase;
  const estimatedQrisFee = Math.max(0, serviceFee - safeFixed);

  return {
    baseAmount: safeBase,
    fixedFee: safeFixed,
    estimatedQrisFee,
    bstnAmount,
    serviceFee,
    grandTotal,
  };
}
