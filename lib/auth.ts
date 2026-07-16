import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { constantTimeEqual, sha256 } from "./security";

const COOKIE="amk_admin";
function key(){const secret=process.env.AUTH_SECRET;if(!secret)throw new Error("AUTH_SECRET belum diisi");return new TextEncoder().encode(secret)}
export async function verifyAdminPassword(email:string,password:string){const expectedEmail=process.env.ADMIN_EMAIL;const expectedHash=process.env.ADMIN_PASSWORD_HASH;if(!expectedEmail||!expectedHash)return process.env.DEMO_MODE==="true"||!process.env.DATABASE_URL;const actual=await sha256(password);return email.toLowerCase()===expectedEmail.toLowerCase()&&constantTimeEqual(actual,expectedHash)}
export async function createAdminToken(email:string){return new SignJWT({email,role:"owner"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("12h").sign(key())}
export async function adminFromRequest(){if(!process.env.ADMIN_PASSWORD_HASH)return {email:"demo@amk.store",role:"owner"};const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;try{return (await jwtVerify(token,key())).payload}catch{return null}}
export async function requireAdmin(){const admin=await adminFromRequest();if(!admin)redirect("/admin-login");return admin}
export const adminCookie={name:COOKIE,options:{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/",maxAge:60*60*12}};
