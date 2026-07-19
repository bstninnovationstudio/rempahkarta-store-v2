import { NextResponse } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createCustomerToken, customerCookie } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getProfileCompleteness } from "@/lib/user-profile";

const requestSchema = z.object({ credential: z.string().min(1).max(10_000) });
const googlePayloadSchema = z.object({
  sub: z.string().min(1).max(120),
  email: z.string().email().max(200),
  email_verified: z.union([z.literal(true), z.literal("true")]),
  name: z.string().max(160).optional(),
  picture: z.string().url().max(500).optional(),
});
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

async function establishSession(user: { id: string; name: string; email: string }, sessionId: string) {
  const [token, completion] = await Promise.all([
    createCustomerToken(user.id, sessionId),
    getProfileCompleteness(user.id),
  ]);
  const response = NextResponse.json({
    success: true,
    user: { name: user.name, email: user.email },
    completion,
  });
  response.cookies.set(customerCookie.name, token, customerCookie.options);
  return response;
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "auth:google", limit: 10, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Credential Google wajib disediakan" }, { status: 400 });
    const { credential } = parsed.data;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return NextResponse.json({ error: "Google Login belum dikonfigurasi" }, { status: 503 });
    let verified;
    try {
      verified = await jwtVerify(credential, googleJwks, {
        algorithms: ["RS256"],
        audience: clientId,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      });
    } catch {
      return NextResponse.json({ error: "Token Google tidak valid atau kadaluwarsa" }, { status: 401 });
    }
    const payload = googlePayloadSchema.safeParse(verified.payload);
    if (!payload.success) {
      return NextResponse.json({ error: "Token Google tidak valid atau kadaluwarsa" }, { status: 401 });
    }

    const sessionId = crypto.randomUUID();
    const user = await prisma.user.upsert({
      where: { googleId: payload.data.sub },
      update: {
        email: payload.data.email,
        name: payload.data.name || payload.data.email.split("@")[0],
        avatarUrl: payload.data.picture || null,
        currentSessionId: sessionId,
      },
      create: {
        googleId: payload.data.sub,
        email: payload.data.email,
        name: payload.data.name || payload.data.email.split("@")[0],
        avatarUrl: payload.data.picture || null,
        currentSessionId: sessionId,
      },
    });
    return establishSession(user, sessionId);
  } catch {
    return NextResponse.json({ error: "Gagal memproses autentikasi Google" }, { status: 500 });
  }
}
