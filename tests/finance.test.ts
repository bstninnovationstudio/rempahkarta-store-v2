import assert from "node:assert/strict";
import test from "node:test";
import { calculateRevenuePosition } from "../lib/finance";

const base = {
  revenueAmount: BigInt(110_009),
  refundedAmount: BigInt(0),
  paymentState: "paid",
  fulfillmentState: "completed",
  issueOrder: false,
  returnStates: [] as string[],
  cancellationStates: [] as string[],
};

test("omzet mencakup produk, ongkir, admin toko, dan kode unik (tanpa fee QRIS)", () => {
  const result = calculateRevenuePosition(base);
  assert.equal(result.originalNet, BigInt(110_009));
  assert.equal(result.available, BigInt(110_009));
  assert.equal(result.held, BigInt(0));
});

test("pesanan lunas yang masih aktif tetap berada di saldo tertahan", () => {
  const result = calculateRevenuePosition({ ...base, fulfillmentState: "handed_over" });
  assert.equal(result.available, BigInt(0));
  assert.equal(result.held, BigInt(110_009));
});

test("isu, retur aktif, dan pembatalan aktif memindahkan pesanan selesai kembali ke tertahan", () => {
  for (const input of [
    { ...base, issueOrder: true },
    { ...base, returnStates: ["requested"] },
    { ...base, cancellationStates: ["provider_failed"] },
  ]) {
    const result = calculateRevenuePosition(input);
    assert.equal(result.available, BigInt(0));
    assert.equal(result.held, BigInt(110_009));
  }
});

test("refund mengurangi posisi omzet dan refund penuh tidak menghasilkan saldo negatif", () => {
  const partial = calculateRevenuePosition({ ...base, paymentState: "partially_refunded", refundedAmount: BigInt(25_000) });
  assert.equal(partial.available, BigInt(85_009));
  const full = calculateRevenuePosition({ ...base, paymentState: "refunded", refundedAmount: BigInt(150_000) });
  assert.equal(full.available, BigInt(0));
  assert.equal(full.held, BigInt(0));
});
