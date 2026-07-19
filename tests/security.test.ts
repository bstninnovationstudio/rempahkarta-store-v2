import assert from "node:assert/strict";
import test from "node:test";
import { fulfillmentFromBiteshipStatus } from "../lib/shipping-state";
import { canApplyAuthoritativePaid } from "../lib/payment-sync";
import { verifyTurnstile } from "../lib/turnstile";
import { safeInternalPath } from "../lib/safe-redirect";
import { createAdminPasswordHash, verifyAdminPasswordHash } from "../lib/password";

test("password admin memakai scrypt bersalt dan verifikasi konstan", async () => {
  const encoded = await createAdminPasswordHash("password-admin-yang-panjang");
  assert.match(encoded, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyAdminPasswordHash("password-admin-yang-panjang", encoded), true);
  assert.equal(await verifyAdminPasswordHash("password-yang-salah", encoded), false);
});

test("redirect hanya menerima path internal yang ternormalisasi", () => {
  assert.equal(safeInternalPath("/checkout?from=cart#summary", "/user"), "/checkout?from=cart#summary");
  assert.equal(safeInternalPath("https://evil.example/path", "/user"), "/user");
  assert.equal(safeInternalPath("//evil.example/path", "/user"), "/user");
  assert.equal(safeInternalPath("/\\evil.example/path", "/user"), "/user");
  assert.equal(safeInternalPath("/user\nmalicious", "/user"), "/user");
});

test("status Biteship memindahkan fulfillment secara tepat", () => {
  assert.equal(fulfillmentFromBiteshipStatus("confirmed"), "shipment_booked");
  assert.equal(fulfillmentFromBiteshipStatus("picking_up"), "handover_pending");
  assert.equal(fulfillmentFromBiteshipStatus("picked"), "handed_over");
  assert.equal(fulfillmentFromBiteshipStatus("delivered"), "completed");
  assert.equal(fulfillmentFromBiteshipStatus("courier_not_found"), "cancelled");
});

test("status paid provider tetap authoritative setelah pembatalan lokal", () => {
  assert.equal(canApplyAuthoritativePaid("pending"), true);
  assert.equal(canApplyAuthoritativePaid("canceled"), true);
  assert.equal(canApplyAuthoritativePaid("expired"), true);
  assert.equal(canApplyAuthoritativePaid("refunded"), false);
  assert.equal(canApplyAuthoritativePaid("partially_refunded"), false);
});

test("Turnstile diverifikasi di server dan action harus cocok", async context => {
  const previous = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: true, action: "checkout_order", hostname: "localhost" }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const request = new Request("http://localhost/api/checkout/orders", { method: "POST" });
    assert.deepEqual(await verifyTurnstile(request, "token-uji", "checkout_order"), { success: true, hostname: "localhost" });
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    if (previous === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previous;
  }
});

test("Turnstile menolak action yang tidak sesuai", async context => {
  const previous = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: true, action: "location_search" }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const result = await verifyTurnstile(new Request("http://localhost"), "token-uji", "shipping_quotes");
    assert.equal(result.success, false);
  } finally {
    if (previous === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previous;
  }
});

test("Turnstile menolak respons yang tidak mengikat action", async context => {
  const previous = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const result = await verifyTurnstile(new Request("http://localhost"), "token-uji", "user_profile");
    assert.equal(result.success, false);
  } finally {
    if (previous === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previous;
  }
});
