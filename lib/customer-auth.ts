import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { assertStrongJwtSecret } from "./security";
import { isProduction } from "./env";
import type { User } from "@prisma/client";

const COOKIE_NAME = "amk_user";
const ISSUER = "rempahkarta-store";
const AUDIENCE = "rempahkarta-customer";

export const USER_PAUSED_ERROR = "Akun anda sedang dijeda oleh karena aktifitas mencurigakan dan sedang dalam peninjauan lebih lanjut.";
export const USER_BLOCKED_ERROR = "Akun anda diblokir oleh karena aktifitas mencurigakan hubungi layanan pelanggan jika ini adalah kesalahan.";

function getJwtKey() {
  const secret = process.env.CUSTOMER_JWT_SECRET || process.env.AUTH_SECRET;
  return new TextEncoder().encode(assertStrongJwtSecret(secret, "CUSTOMER_JWT_SECRET atau AUTH_SECRET"));
}

export async function createCustomerToken(userId: string, sessionId: string) {
  return new SignJWT({ userId, sessionId, tokenUse: "customer" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtKey());
}

export async function customerFromRequest() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      payload.tokenUse !== "customer" ||
      typeof payload.userId !== "string" ||
      typeof payload.sessionId !== "string" ||
      payload.sub !== payload.userId
    ) return null;
    const userId = payload.userId;
    const sessionId = payload.sessionId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // Device Lock: check if session matches
    if (user.currentSessionId !== sessionId) {
      return null;
    }

    // Block check: blocked users cannot maintain active session
    if (user.status === "BLOCK") {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function assertCustomerActive(user: User): NextResponse | null {
  if (user.status === "BLOCK") {
    return NextResponse.json({ error: USER_BLOCKED_ERROR }, { status: 403 });
  }
  if (user.status === "PAUSE") {
    return NextResponse.json({ error: USER_PAUSED_ERROR }, { status: 403 });
  }
  return null;
}

import { getStoreOperationalStatus } from "./store-schedule";

export async function assertStoreOperational(): Promise<NextResponse | null> {
  const opStatus = await getStoreOperationalStatus();
  if (opStatus.isMaintenance) {
    const endWib = opStatus.maintenanceEndAtWib ? opStatus.maintenanceEndAtWib : "waktu yang ditentukan";
    return NextResponse.json(
      {
        error: `Layanan transaksi sedang dalam pemeliharaan berkala hingga ${endWib} demi meningkatkan kenyamanan Anda. Silakan kembali setelah masa pemeliharaan selesai.`,
      },
      { status: 503 }
    );
  }
  return null;
}

export function assertCustomerNotBlocked(user: User): NextResponse | null {
  if (user.status === "BLOCK") {
    return NextResponse.json({ error: USER_BLOCKED_ERROR }, { status: 403 });
  }
  return null;
}

export async function requireCustomer(redirectPath: string = "/user") {
  const user = await customerFromRequest();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }
  return user;
}

export const customerCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  }
};

