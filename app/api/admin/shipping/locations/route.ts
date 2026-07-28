import { NextResponse } from "next/server";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { getBiteshipApiKey } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { BiteshipBalanceError, reserveBiteshipFunds, reverseBiteshipFunds } from "@/lib/finance";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:shipping-location-search", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3 || q.length > 120) {
    return NextResponse.json({ error: "Kata pencarian harus 3–120 karakter" }, { status: 400 });
  }

  const apiKey = getBiteshipApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "BITESHIP_API_KEY belum dikonfigurasi di server" }, { status: 503 });
  }

  try {
    const adapter = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", apiKey);
    const reservation = await reserveBiteshipFunds({
      kind: "area",
      referenceId: String(admin.email),
      notes: `Pencarian area Biteship oleh admin ${String(admin.email)}`,
      actorId: String(admin.email),
    });
    let data;
    try {
      data = await adapter.searchAreas(q);
    } catch (cause) {
      await reverseBiteshipFunds(reservation, "Pencarian area Biteship admin gagal");
      throw cause;
    }
    return NextResponse.json(data);
  } catch (cause) {
    if (cause instanceof BiteshipBalanceError) {
      return NextResponse.json({ error: "Saldo Biteship tidak mencukupi" }, { status: 409 });
    }
    const message = cause instanceof Error ? cause.message : "Pencarian lokasi Biteship gagal";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
