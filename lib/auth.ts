import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertStrongJwtSecret, constantTimeEqual, sha256 } from "./security";
import { verifyAdminPasswordHash } from "./password";

const COOKIE = "amk_admin";
const ISSUER = "rempahkarta-store";
const AUDIENCE = "rempahkarta-admin";

function demoAdminEnabled() {
  return process.env.NODE_ENV !== "production"
    && process.env.DEMO_MODE === "true"
    && process.env.ALLOW_INSECURE_DEMO === "true";
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (demoAdminEnabled()) return new TextEncoder().encode("development-demo-secret-not-for-production");
  }
  return new TextEncoder().encode(assertStrongJwtSecret(secret, "AUTH_SECRET"));
}

export async function verifyAdminPassword(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedScrypt = process.env.ADMIN_PASSWORD_SCRYPT;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedEmail) return demoAdminEnabled();
  const emailMatches = email.toLowerCase() === expectedEmail.toLowerCase();
  if (expectedScrypt) {
    // Always perform the expensive comparison so response timing does not
    // disclose whether the configured admin email was guessed correctly.
    const passwordMatches = await verifyAdminPasswordHash(password, expectedScrypt);
    return emailMatches && passwordMatches;
  }
  if (process.env.NODE_ENV !== "production" && expectedHash?.length === 64) {
    const actual = await sha256(password);
    return emailMatches && constantTimeEqual(actual, expectedHash.toLowerCase());
  }
  return demoAdminEnabled();
}

export async function createAdminToken(email: string) {
  return new SignJWT({ email, role: "owner", tokenUse: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(email.toLowerCase())
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
}

export async function adminFromRequest() {
  if (demoAdminEnabled() && !process.env.ADMIN_PASSWORD_SCRYPT && !process.env.ADMIN_PASSWORD_HASH) return { email: "demo@amk.store", role: "owner" };
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.tokenUse !== "admin" || payload.role !== "owner" || typeof payload.email !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
export async function requireAdmin(){const admin=await adminFromRequest();if(!admin)redirect("/admin-login");return admin}
export const adminCookie={name:COOKIE,options:{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/",maxAge:60*60*12}};
