import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { withdrawRevenue } from "@/lib/finance";
import { hasExactAppOrigin } from "@/lib/security";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { serializeBigInt } from "@/lib/serialize";

const schema = z.object({ amount: z.string().regex(/^[1-9]\d{0,17}$/), notes: z.string().trim().max(500).optional() });

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:finance-withdrawal", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Nominal penarikan tidak valid", details: body.error.flatten() }, { status: 400 });
  try {
    const entry = await withdrawRevenue({ amount: BigInt(body.data.amount), notes: body.data.notes, actorId: String(admin.email) });
    return NextResponse.json({ success: true, entry: serializeBigInt(entry) });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Penarikan belum dapat dicatat" }, { status: 409 });
  }
}
