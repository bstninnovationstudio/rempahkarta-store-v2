import assert from "node:assert/strict";
import test from "node:test";
import { paginationMeta, readPagination } from "../lib/pagination";
import { checkRateLimit, rateLimitHeaders } from "../lib/rate-limit";

test("pagination clamps page size and rejects unsafe numeric input", () => {
  assert.deepEqual(
    readPagination("https://store.test/api/orders?page=3&pageSize=500", { defaultPageSize: 20, maxPageSize: 50 }),
    { page: 3, pageSize: 50, skip: 100 },
  );
  assert.deepEqual(
    readPagination("https://store.test/api/orders?page=-4&pageSize=not-a-number", { defaultPageSize: 10, maxPageSize: 25 }),
    { page: 1, pageSize: 10, skip: 0 },
  );
  assert.deepEqual(paginationMeta(21, 2, 10), {
    page: 2,
    pageSize: 10,
    total: 21,
    totalPages: 3,
    hasPrevious: true,
    hasNext: true,
  });
});

test("in-memory limiter blocks above policy and exposes standard headers", () => {
  const request = new Request("https://store.test/api/test", { headers: { "x-real-ip": "192.0.2.10" } });
  const scope = `test:block:${crypto.randomUUID()}`;
  assert.equal(checkRateLimit(request, { scope, limit: 2 }).allowed, true);
  assert.equal(checkRateLimit(request, { scope, limit: 2 }).allowed, true);
  const blocked = checkRateLimit(request, { scope, limit: 2 });
  assert.equal(blocked.allowed, false);
  const headers = rateLimitHeaders(blocked);
  assert.equal(headers["X-RateLimit-Limit"], "2");
  assert.equal(headers["X-RateLimit-Remaining"], "0");
  assert.ok(Number(headers["Retry-After"]) >= 1);
});

test("in-memory limiter resets after the fixed window", async () => {
  const request = new Request("https://store.test/api/test", { headers: { "x-real-ip": "192.0.2.11" } });
  const scope = `test:reset:${crypto.randomUUID()}`;
  assert.equal(checkRateLimit(request, { scope, limit: 1, windowMs: 5 }).allowed, true);
  assert.equal(checkRateLimit(request, { scope, limit: 1, windowMs: 5 }).allowed, false);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(checkRateLimit(request, { scope, limit: 1, windowMs: 5 }).allowed, true);
});

