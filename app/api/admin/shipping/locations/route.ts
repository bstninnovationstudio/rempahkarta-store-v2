import { NextResponse } from "next/server";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { getBiteshipApiKey } from "@/lib/env";

export async function GET(request: Request) {
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
    const data = await adapter.searchAreas(q);
    return NextResponse.json(data);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Pencarian lokasi Biteship gagal";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
