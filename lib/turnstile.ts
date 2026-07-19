import { requestClientKey } from "@/lib/rate-limit";
import { isProduction, getAppUrl } from "@/lib/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEVELOPMENT_SECRET = "1x0000000000000000000000000000000AA";

type TurnstileResult = { success: boolean; action?: string; hostname?: string; "error-codes"?: string[] };

export async function verifyTurnstile(request: Request, token: string, expectedAction: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY || (!isProduction() ? DEVELOPMENT_SECRET : "");
  if (isProduction() && secret === DEVELOPMENT_SECRET) {
    return { success: false, error: "Kunci uji Turnstile tidak boleh digunakan di production" };
  }
  if (!secret || !token || token.length > 2048) return { success: false, error: "Verifikasi keamanan belum lengkap" };
  const clientKey = requestClientKey(request);
  const remoteIp = clientKey === "unidentified" ? undefined : clientKey;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: remoteIp || undefined, idempotency_key: crypto.randomUUID() }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as TurnstileResult;
    if (!response.ok || !result.success) return { success: false, error: "Verifikasi keamanan gagal. Silakan coba kembali.", codes: result["error-codes"] };
    if (result.action !== expectedAction) return { success: false, error: "Aksi verifikasi keamanan tidak sesuai" };
    if (isProduction()) {
      const appUrl = getAppUrl();
      let expectedHostname = "";
      try { expectedHostname = new URL(appUrl || "").hostname; } catch { /* handled below */ }
      if (!expectedHostname || result.hostname !== expectedHostname) {
        return { success: false, error: "Domain verifikasi keamanan tidak sesuai" };
      }
    }
    return { success: true, hostname: result.hostname };
  } catch {
    return { success: false, error: "Layanan verifikasi keamanan tidak dapat dihubungi" };
  }
}

export function turnstileSiteKey() {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (!isProduction() ? "1x00000000000000000000BB" : "");
  return isProduction() && key === "1x00000000000000000000BB" ? "" : key;
}
