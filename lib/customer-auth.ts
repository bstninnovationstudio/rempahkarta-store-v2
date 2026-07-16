import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

const COOKIE_NAME = "amk_user";

function getJwtKey() {
  const secret = process.env.CUSTOMER_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("CUSTOMER_JWT_SECRET atau AUTH_SECRET belum diisi");
  return new TextEncoder().encode(secret);
}

export async function createCustomerToken(userId: string, sessionId: string) {
  return new SignJWT({ userId, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtKey());
}

export async function customerFromRequest() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtKey());
    const userId = payload.userId as string;
    const sessionId = payload.sessionId as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // Device Lock: check if session matches
    if (user.currentSessionId !== sessionId) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  }
};
