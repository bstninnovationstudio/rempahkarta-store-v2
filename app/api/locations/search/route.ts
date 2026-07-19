import { NextResponse } from "next/server";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { verifyTurnstile } from "@/lib/turnstile";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "checkout:location-search", limit: 25 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3 || q.length > 120) return NextResponse.json({ error: "Kata pencarian harus 3–120 karakter" }, { status: 400 });
  const verification = await verifyTurnstile(request, request.headers.get("x-turnstile-token") || "", "location_search");
  if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
  if (!process.env.BITESHIP_API_KEY) return NextResponse.json({ error: "BITESHIP_API_KEY belum dikonfigurasi" }, { status: 503 });
  try {
    const data = await new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", process.env.BITESHIP_API_KEY).searchAreas(q);
    return NextResponse.json(data);
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Pencarian lokasi Biteship gagal" }, { status: 502 }); }
}
