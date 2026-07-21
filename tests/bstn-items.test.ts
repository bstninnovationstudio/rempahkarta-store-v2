import assert from "node:assert/strict";
import test from "node:test";
import { buildBstnItems } from "../lib/bstn-items";

test("voucher payment lines tetap non-negatif dan jumlahnya tepat", () => {
  const items = buildBstnItems({
    productItems: [{ id: "SKU", name: "Rempah", price: 1000, quantity: 2 }],
    shippingItem: { id: "SHIPPING", name: "Ongkir", price: 500, quantity: 1 },
    discountAmount: 1500,
    target: "TOTAL",
    serviceFee: 500,
  });
  assert.ok(items.every(item => item.price >= 0));
  assert.equal(items.reduce((sum, item) => sum + item.price * item.quantity, 0), 1500);
});

test("voucher target ongkir hanya mengurangi line ongkir", () => {
  const items = buildBstnItems({
    productItems: [{ id: "SKU", name: "Rempah", price: 1000, quantity: 1 }],
    shippingItem: { id: "SHIPPING", name: "Ongkir", price: 500, quantity: 1 },
    discountAmount: 300,
    target: "SHIPPING",
    serviceFee: 0,
  });
  assert.equal(items.find(item => item.id === "SKU")?.price, 1000);
  assert.equal(items.reduce((sum, item) => sum + item.price * item.quantity, 0), 1200);
});
