const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEVELOPMENT_SECRET = "1x0000000000000000000000000000000AA";

type TurnstileResult = { success: boolean; action?: string; hostname?: string; "error-codes"?: string[] };

export async function verifyTurnstile(request: Request, token: string, expectedAction: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV !== "production" ? DEVELOPMENT_SECRET : "");
  if (!secret || !token || token.length > 2048) return { success: false, error: "Verifikasi keamanan belum lengkap" };
  const remoteIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: remoteIp || undefined, idempotency_key: crypto.randomUUID() }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as TurnstileResult;
    if (!response.ok || !result.success) return { success: false, error: "Verifikasi keamanan gagal. Silakan coba kembali.", codes: result["error-codes"] };
    if (result.action && result.action !== expectedAction) return { success: false, error: "Aksi verifikasi keamanan tidak sesuai" };
    return { success: true, hostname: result.hostname };
  } catch {
    return { success: false, error: "Layanan verifikasi keamanan tidak dapat dihubungi" };
  }
}

export function turnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (process.env.NODE_ENV !== "production" ? "1x00000000000000000000BB" : "");
}
