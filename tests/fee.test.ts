import assert from "node:assert/strict";
import test from "node:test";
import { calculateServiceFee } from "../lib/fee";

test("calculateServiceFee menghitung gross-up terpadu dengan benar", () => {
  // Scenario 1: Base = 40.000 (Subtotal 30k + Ongkir 10k), fixedFee = 500, rate = 0.007
  const res1 = calculateServiceFee(40000, 500, 0.007);
  assert.equal(res1.baseAmount, 40000);
  assert.equal(res1.fixedFee, 500);
  assert.equal(res1.bstnAmount, 40500);
  // Math.ceil(40500 / 0.993) = 40786
  assert.equal(res1.grandTotal, 40786);
  assert.equal(res1.serviceFee, 786);
  assert.equal(res1.baseAmount + res1.serviceFee, res1.grandTotal);

  // Scenario 2: Base = 79.000 + 7.000 = 86.000, fixedFee = 500, rate = 0.007
  const res2 = calculateServiceFee(86000, 500, 0.007);
  assert.equal(res2.baseAmount, 86000);
  assert.equal(res2.bstnAmount, 86500);
  // Math.ceil(86500 / 0.993) = 87110
  assert.equal(res2.grandTotal, 87110);
  assert.equal(res2.serviceFee, 1110);
  assert.equal(res2.baseAmount + res2.serviceFee, res2.grandTotal);
});
