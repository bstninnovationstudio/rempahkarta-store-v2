import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders, rateLimitResponse } from "@/lib/rate-limit";
import { isProduction, getAppUrl } from "@/lib/env";
import { MAX_IMAGE_MULTIPART_BYTES, MAX_WEBHOOK_BYTES } from "@/lib/request-body";

function routeSpecificPolicy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (/^\/api\/admin\/(categories|products|inventory|vouchers)(\/|$)/.test(path) && unsafe) {
    return { scope: "api:admin-catalog-mutation", limit: 30 };
  }
  if (/^\/api\/admin\/orders(\/|$)/.test(path) && unsafe) {
    return { scope: "api:admin-order-mutation", limit: 20 };
  }
  if (/^\/api\/admin\/shipping(\/|$)/.test(path)) {
    return { scope: unsafe ? "api:admin-shipping-mutation" : "api:admin-shipping-provider-read", limit: unsafe ? 20 : 30 };
  }
  if (/^\/api\/admin\/media(\/|$)/.test(path)) {
    return { scope: unsafe ? "api:admin-media-mutation" : "api:admin-media-read", limit: unsafe ? 15 : 120 };
  }
  if (/^\/api\/cron(\/|$)/.test(path)) {
    return { scope: "api:cron", limit: 30 };
  }
  if (/^\/api\/orders\/[^/]+\/payment\/status$/.test(path)) {
    return { scope: "api:payment-status", limit: 60 };
  }
  if (
    request.method === "GET"
    && (/^\/api\/orders\/[^/]+\/media\//.test(path) || /^\/api\/returns\/[^/]+\/media\//.test(path))
  ) {
    return { scope: "api:private-media-read", limit: 120 };
  }
  return null;
}

export function proxy(request: NextRequest) {
  const webhook = request.nextUrl.pathname.startsWith("/api/webhooks/");
  const unsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const isImageUpload = request.nextUrl.pathname === "/api/admin/media/upload-url"
    || request.nextUrl.pathname === "/api/admin/promotions"
    || /^\/api\/orders\/[^/]+\/media$/.test(request.nextUrl.pathname);
  const contentLength = request.headers.get("content-length");
  const maximumBodyBytes = webhook
    ? MAX_WEBHOOK_BYTES
    : isImageUpload
      ? MAX_IMAGE_MULTIPART_BYTES
      : 1024 * 1024;
  if (
    contentLength
    && (
      !/^\d{1,18}$/.test(contentLength)
      || !Number.isSafeInteger(Number(contentLength))
      || Number(contentLength) > maximumBodyBytes
    )
  ) {
    return NextResponse.json({ error: "Ukuran request melebihi batas" }, { status: 413 });
  }
  if (!webhook && unsafeMethod) {
    const origin = request.headers.get("origin");
    if (origin) {
      const allowedOrigins = new Set<string>([request.nextUrl.origin]);
      const appUrl = getAppUrl();
      if (appUrl) {
        try { allowedOrigins.add(new URL(appUrl).origin); } catch {}
      }
      const appDev = process.env.APP_URL_DEV;
      if (appDev) {
        try { allowedOrigins.add(new URL(appDev).origin); } catch {}
      }
      const appLive = process.env.APP_URL_LIVE;
      if (appLive) {
        try {
          const liveUrl = new URL(appLive);
          allowedOrigins.add(liveUrl.origin);
          if (liveUrl.hostname.startsWith("www.")) {
            allowedOrigins.add(`${liveUrl.protocol}//${liveUrl.hostname.slice(4)}${liveUrl.port ? `:${liveUrl.port}` : ""}`);
          } else {
            allowedOrigins.add(`${liveUrl.protocol}//www.${liveUrl.hostname}${liveUrl.port ? `:${liveUrl.port}` : ""}`);
          }
        } catch {}
      }
      if (!allowedOrigins.has(origin)) {
        return NextResponse.json({ error: "Origin permintaan tidak diizinkan" }, { status: 403 });
      }
    }
  }
  const universal = checkRateLimit(request, {
    scope: webhook ? "api:webhook" : "api:universal",
    limit: webhook ? 1_000 : 100,
  });
  if (!universal.allowed) return rateLimitResponse(universal);

  const specificPolicy = routeSpecificPolicy(request);
  const specific = specificPolicy ? checkRateLimit(request, specificPolicy) : null;
  if (specific && !specific.allowed) return rateLimitResponse(specific);

  const response = NextResponse.next();
  const headers = rateLimitHeaders(specific || universal);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
