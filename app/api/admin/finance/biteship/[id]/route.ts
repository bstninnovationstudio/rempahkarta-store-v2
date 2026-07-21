import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { BiteshipBalanceError, deleteManualBiteshipEntry, updateManualBiteshipEntry } from "@/lib/finance";
import { hasExactAppOrigin } from "@/lib/security";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { serializeBigInt } from "@/lib/serialize";

const schema = z.object({ type: z.enum(["TOP_UP", "DEDUCT_MANUAL"]), amount: z.string().regex(/^[1-9]\d{0,17}$/), notes: z.string().trim().min(3).max(500) });

async function authorize(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:biteship-fund", limit: 20 });
  if (!rate.allowed) return { response: rateLimitResponse(rate), admin: null };
  const admin = await adminFromRequest();
  if (!admin) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), admin: null };
  if (!hasExactAppOrigin(request)) return { response: NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 }), admin: null };
  return { response: null, admin };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request); if (auth.response || !auth.admin) return auth.response!;
  let json: unknown; try { json = await request.json(); } catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json); if (!body.success) return NextResponse.json({ error: "Catatan dana tidak valid" }, { status: 400 });
  try {
    const { id } = await params;
    const entry = await updateManualBiteshipEntry({ id, ...body.data, amount: BigInt(body.data.amount), actorId: String(auth.admin.email) });
    return NextResponse.json({ success: true, entry: serializeBigInt(entry) });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Catatan dana belum dapat diubah" }, { status: cause instanceof BiteshipBalanceError ? 409 : 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request); if (auth.response || !auth.admin) return auth.response!;
  try {
    const { id } = await params;
    await deleteManualBiteshipEntry({ id, actorId: String(auth.admin.email) });
    return NextResponse.json({ success: true });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Catatan dana belum dapat dihapus" }, { status: cause instanceof BiteshipBalanceError ? 409 : 400 });
  }
}
