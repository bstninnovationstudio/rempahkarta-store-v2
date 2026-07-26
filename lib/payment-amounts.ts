type MoneyInput = bigint | number | null | undefined;

function money(value: MoneyInput) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.round(value));
  return BigInt(0);
}

function nonNegative(value: bigint) {
  return value > BigInt(0) ? value : BigInt(0);
}

export function deriveUniqueCode(input: {
  uniqueCode?: MoneyInput;
  payableAmount?: MoneyInput;
  grandTotal?: MoneyInput;
}) {
  const stored = nonNegative(money(input.uniqueCode));
  if (stored > BigInt(0)) return stored;
  return nonNegative(money(input.payableAmount) - money(input.grandTotal));
}

export function calculatePaymentAmounts(input: {
  subtotal: MoneyInput;
  shippingFee: MoneyInput;
  discountAmount: MoneyInput;
  serviceFee: MoneyInput;
  grandTotal: MoneyInput;
  payableAmount?: MoneyInput;
  feeAmount?: MoneyInput;
  uniqueCode?: MoneyInput;
}) {
  const subtotal = nonNegative(money(input.subtotal));
  const shippingFee = nonNegative(money(input.shippingFee));
  const discountAmount = nonNegative(money(input.discountAmount));
  const serviceFee = nonNegative(money(input.serviceFee));
  const grandTotal = nonNegative(money(input.grandTotal));
  const payableAmount = nonNegative(money(input.payableAmount)) || grandTotal;
  const uniqueCode = deriveUniqueCode({
    uniqueCode: input.uniqueCode,
    payableAmount,
    grandTotal,
  });
  // BSTN fee_amount mencakup admin_fee QRIS + unique_code. Pisahkan agar kode
  // unik dan admin toko (serviceFee - qrisFee) tetap menjadi omzet toko,
  // sedangkan fee QRIS (BSTN) dipisahkan dari omzet.
  const qrisFee = nonNegative(money(input.feeAmount) - uniqueCode);
  const productRevenue = nonNegative(subtotal - discountAmount);
  const storeAdminFee = nonNegative(serviceFee - qrisFee);
  const revenueBeforeRefund = productRevenue + shippingFee + storeAdminFee + uniqueCode;

  return {
    subtotal,
    discountAmount,
    productRevenue,
    shippingFee,
    serviceFee,
    storeAdminFee,
    qrisFee,
    uniqueCode,
    grandTotal,
    payableAmount,
    revenueBeforeRefund,
  };
}

export function readBstnUniqueCode(payload: unknown, fallback: MoneyInput = 0) {
  if (!payload || typeof payload !== "object") return nonNegative(money(fallback));
  const data = payload as Record<string, unknown>;
  const qris = data.qris && typeof data.qris === "object" ? data.qris as Record<string, unknown> : null;
  const candidate = qris?.unique_code ?? data.qris_unique_code ?? data.unique_code;
  if (typeof candidate === "bigint") return nonNegative(candidate);
  if (typeof candidate === "number" && Number.isFinite(candidate)) return nonNegative(BigInt(Math.round(candidate)));
  if (typeof candidate === "string" && /^\d+$/.test(candidate.trim())) return BigInt(candidate.trim());
  return nonNegative(money(fallback));
}
