import { NextResponse } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createCustomerToken, customerCookie, USER_BLOCKED_ERROR, assertStoreOperational } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getProfileCompleteness } from "@/lib/user-profile";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";

const requestSchema = z.object({ credential: z.string().min(1).max(10_000) });
const googlePayloadSchema = z.object({
  sub: z.string().min(1).max(120),
  email: z.string().email().max(200),
  email_verified: z.union([z.literal(true), z.literal("true")]),
  name: z.string().max(160).optional(),
  picture: z.string().url().max(500).optional(),
});
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

class GoogleIdentityConflictError extends Error {}
class GoogleUserBlockedError extends Error {}

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

  const storeCheck = await assertStoreOperational();
  if (storeCheck) return storeCheck;

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

    const subjectRate = checkRateLimit(request, {
      scope: "auth:google-subject",
      identity: payload.data.sub,
      limit: 10,
      windowMs: 5 * 60_000,
    });
    if (!subjectRate.allowed) return rateLimitResponse(subjectRate);

    const sessionId = crypto.randomUUID();
    const email = payload.data.email.toLowerCase();
    const name = payload.data.name || email.split("@")[0];
    const user = await prisma.$transaction(async tx => {
      const byGoogle = await tx.user.findUnique({ where: { googleId: payload.data.sub } });
      const byEmail = await tx.user.findUnique({ where: { email } });
      if (byGoogle) {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM \`User\` WHERE id = ${byGoogle.id} FOR UPDATE`);
        const current = await tx.user.findUniqueOrThrow({ where: { id: byGoogle.id } });
        if (current.status === "BLOCK") throw new GoogleUserBlockedError();
        if (byEmail && byEmail.id !== current.id) {
          throw new GoogleIdentityConflictError("Email Google sudah terhubung ke akun lain");
        }
        return tx.user.update({
          where: { id: current.id },
          data: {
            email,
            name,
            avatarUrl: payload.data.picture || null,
            currentSessionId: sessionId,
          },
        });
      }
      if (byEmail) {
        // A verified email is not sufficient to replace an existing Google
        // subject. Keep the stable `sub` binding to prevent account takeover.
        if (byEmail.status === "BLOCK") throw new GoogleUserBlockedError();
        throw new GoogleIdentityConflictError("Akun email sudah terhubung ke identitas Google lain");
      }
      return tx.user.create({
        data: {
          googleId: payload.data.sub,
          email,
          name,
          avatarUrl: payload.data.picture || null,
          currentSessionId: sessionId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return establishSession(user, sessionId);
  } catch (error) {
    if (error instanceof GoogleUserBlockedError) {
      return NextResponse.json({ error: USER_BLOCKED_ERROR }, { status: 403 });
    }
    if (error instanceof GoogleIdentityConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Sesi login berubah. Silakan ulangi login Google." }, { status: 409 });
    }
    console.error("[Google Auth Error]", error);
    return NextResponse.json({ error: "Gagal memproses autentikasi Google" }, { status: 500 });
  }
}
