import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
  lastSeenAt: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

declare global {
  var __amkRateLimitStore: RateLimitStore | undefined;
}

const store = globalThis.__amkRateLimitStore ?? new Map<string, RateLimitBucket>();
globalThis.__amkRateLimitStore = store;

const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

export type RateLimitPolicy = {
  scope: string;
  limit: number;
  windowMs?: number;
  identity?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function requestClientKey(request: Request) {
  const configuredHeader = process.env.RATE_LIMIT_TRUSTED_IP_HEADER?.trim().toLowerCase();
  // Forwarded IP headers are caller-controlled unless an explicitly trusted
  // reverse proxy strips and rewrites them. Fail closed instead of silently
  // accepting a spoofable header that would let clients rotate rate-limit keys.
  const candidates = configuredHeader && ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"].includes(configuredHeader)
    ? [request.headers.get(configuredHeader)?.split(",")[0]?.trim()]
    : [];
  const address = candidates.find(value => value && value.length <= 64 && /^[0-9a-f:.]+$/i.test(value));
  return address || "unidentified";
}

function cleanup(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS && store.size <= MAX_BUCKETS) return;
  lastCleanupAt = now;

  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }

  if (store.size <= MAX_BUCKETS) return;
  const removeCount = Math.max(store.size - MAX_BUCKETS, Math.ceil(MAX_BUCKETS * 0.1));
  const oldest = [...store.entries()]
    .sort((left, right) => left[1].lastSeenAt - right[1].lastSeenAt)
    .slice(0, removeCount);
  for (const [key] of oldest) {
    store.delete(key);
  }
}

export function checkRateLimit(request: Request, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const windowMs = policy.windowMs ?? 60_000;
  if (
    !policy.scope
    || policy.scope.length > 160
    || !Number.isSafeInteger(policy.limit)
    || policy.limit < 1
    || !Number.isSafeInteger(windowMs)
    || windowMs < 1
    || windowMs > 24 * 60 * 60_000
  ) {
    throw new Error("Kebijakan rate limit tidak valid");
  }
  cleanup(now);

  const identity = policy.identity || requestClientKey(request);
  const key = `${policy.scope}:${identity}`;
  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs, lastSeenAt: now };
  }
  bucket.count += 1;
  bucket.lastSeenAt = now;
  store.set(key, bucket);

  const remaining = Math.max(0, policy.limit - bucket.count);
  return {
    allowed: bucket.count <= policy.limit,
    limit: policy.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.", code: "RATE_LIMITED" },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}
