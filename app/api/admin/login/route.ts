import { NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, createAdminToken, verifyAdminPassword } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(256),
  turnstileToken: z.string().min(1).max(2048),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "auth:admin-login:client", limit: 20, windowMs: 15 * 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
    const accountRate = checkRateLimit(request, {
      scope: "auth:admin-login:account",
      identity: parsed.data.email.toLowerCase(),
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (!accountRate.allowed) return rateLimitResponse(accountRate);
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "admin_login");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    if (!await verifyAdminPassword(parsed.data.email, parsed.data.password)) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(adminCookie.name, await createAdminToken(parsed.data.email), adminCookie.options);
    return response;
  } catch {
    return NextResponse.json({ error: "Permintaan login tidak valid" }, { status: 400 });
  }
}
