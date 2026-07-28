import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertStrongJwtSecret, constantTimeEqual, sha256 } from "./security";
import { verifyAdminPasswordHash } from "./password";
import { isProduction } from "./env";

const COOKIE = "amk_admin";
const ISSUER = "rempahkarta-store";
const AUDIENCE = "rempahkarta-admin";

function key() {
  const secret = process.env.AUTH_SECRET;
  return new TextEncoder().encode(assertStrongJwtSecret(secret, "AUTH_SECRET"));
}

export async function verifyAdminPassword(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedScrypt = process.env.ADMIN_PASSWORD_SCRYPT;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedEmail) return false;
  const emailMatches = email.toLowerCase() === expectedEmail.toLowerCase();
  if (expectedScrypt) {
    // Always perform the expensive comparison so response timing does not
    // disclose whether the configured admin email was guessed correctly.
    const passwordMatches = await verifyAdminPasswordHash(password, expectedScrypt);
    return emailMatches && passwordMatches;
  }
  if (!isProduction() && expectedHash?.length === 64) {
    const actual = await sha256(password);
    return emailMatches && constantTimeEqual(actual, expectedHash.toLowerCase());
  }
  return false;
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
export const adminCookie={name:COOKIE,options:{httpOnly:true,secure:isProduction(),sameSite:"strict" as const,path:"/",maxAge:60*60*12,priority:"high" as const}};
