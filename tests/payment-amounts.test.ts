import assert from "node:assert/strict";
import test from "node:test";
import { calculatePaymentAmounts, readBstnUniqueCode } from "../lib/payment-amounts";

test("rincian pembayaran memisahkan kode unik dari biaya layanan", () => {
  const amounts = calculatePaymentAmounts({
    subtotal: 117_230,
    shippingFee: 14_000,
    discountAmount: 14_000,
    serviceFee: 1_330,
    grandTotal: 118_560,
    payableAmount: 118_569,
    feeAmount: 839,
    uniqueCode: 9,
  });
  assert.equal(amounts.productRevenue, BigInt(103_230));
  assert.equal(amounts.storeAdminFee, BigInt(500));
  assert.equal(amounts.qrisFee, BigInt(830));
  assert.equal(amounts.uniqueCode, BigInt(9));
  assert.equal(amounts.revenueBeforeRefund, BigInt(117_739));
  assert.equal(amounts.payableAmount, BigInt(118_569));
});

test("kode unik lama dapat diturunkan dari total QRIS dan invoice", () => {
  const amounts = calculatePaymentAmounts({
    subtotal: 100_000,
    shippingFee: 10_000,
    discountAmount: 0,
    serviceFee: 1_276,
    grandTotal: 111_276,
    payableAmount: 111_284,
  });
  assert.equal(amounts.uniqueCode, BigInt(8));
});

test("kode unik dibaca dari respons QRIS BSTN", () => {
  assert.equal(readBstnUniqueCode({ qris: { unique_code: "09" } }), BigInt(9));
  assert.equal(readBstnUniqueCode({ qris_unique_code: "08" }), BigInt(8));
});
