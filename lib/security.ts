export async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("")}
export function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}
export async function hmacHex(secret:string,body:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));return Array.from(new Uint8Array(signature)).map(b=>b.toString(16).padStart(2,"0")).join("")}
export function randomToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("")}

export function assertStrongJwtSecret(secret: string | undefined, label: string) {
  if (!secret || secret.length < 32) throw new Error(`${label} minimal 32 karakter belum diisi`);
  if (
    process.env.NODE_ENV === "production"
    && /(replace|change.?me|development|example|test-secret|not-for-production)/i.test(secret)
  ) {
    throw new Error(`${label} production masih menggunakan nilai contoh yang tidak aman`);
  }
  return secret;
}

export function isStrongSharedSecret(secret: string | undefined, minimumLength = 16) {
  if (!secret || secret.length < minimumLength) return false;
  return process.env.NODE_ENV !== "production"
    || !/(replace|change.?me|development|example|test-secret|not-for-production)/i.test(secret);
}
