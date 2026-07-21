import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BiteshipBalanceError, createManualBiteshipEntry, getBiteshipStats } from "@/lib/finance";
import { hasExactAppOrigin } from "@/lib/security";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { serializeBigInt } from "@/lib/serialize";

const schema = z.object({ type: z.enum(["TOP_UP", "DEDUCT_MANUAL"]), amount: z.string().regex(/^[1-9]\d{0,17}$/), notes: z.string().trim().min(3).max(500) });

export async function GET(request: Request) {
  if (!await adminFromRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize")) || 20));
  const [stats, entries, total] = await Promise.all([
    getBiteshipStats(),
    prisma.biteshipLedger.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.biteshipLedger.count(),
  ]);
  return NextResponse.json(serializeBigInt({ stats, entries, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } }));
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:biteship-fund", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Catatan dana tidak valid", details: body.error.flatten() }, { status: 400 });
  try {
    const entry = await createManualBiteshipEntry({ ...body.data, amount: BigInt(body.data.amount), actorId: String(admin.email) });
    return NextResponse.json({ success: true, entry: serializeBigInt(entry) }, { status: 201 });
  } catch (cause) {
    const status = cause instanceof BiteshipBalanceError ? 409 : 500;
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Catatan dana belum dapat disimpan" }, { status });
  }
}
