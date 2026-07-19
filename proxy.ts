import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders, rateLimitResponse } from "@/lib/rate-limit";

export function proxy(request: NextRequest) {
  const webhook = request.nextUrl.pathname.startsWith("/api/webhooks/");
  const unsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (!webhook && unsafeMethod) {
    let expectedOrigin = request.nextUrl.origin;
    if (process.env.APP_URL) {
      try { expectedOrigin = new URL(process.env.APP_URL).origin; }
      catch {
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "APP_URL production tidak valid" }, { status: 503 });
        }
      }
    }
    const origin = request.headers.get("origin");
    if ((process.env.NODE_ENV === "production" || origin) && origin !== expectedOrigin) {
      return NextResponse.json({ error: "Origin permintaan tidak diizinkan" }, { status: 403 });
    }
  }
  const result = checkRateLimit(request, {
    scope: webhook ? "api:webhook" : "api:universal",
    limit: webhook ? 1_000 : 100,
  });
  if (!result.allowed) return rateLimitResponse(result);

  const response = NextResponse.next();
  const headers = rateLimitHeaders(result);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
