import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { updateBiteshipCosts } from "@/lib/finance";
import { hasExactAppOrigin } from "@/lib/security";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { serializeBigInt } from "@/lib/serialize";

const schema = z.object({ areaSearchCost: z.number().int().nonnegative().max(10_000_000), rateQuoteCost: z.number().int().nonnegative().max(10_000_000), trackingCheckCost: z.number().int().nonnegative().max(10_000_000) });

export async function PUT(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:biteship-settings", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  let json: unknown; try { json = await request.json(); } catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json); if (!body.success) return NextResponse.json({ error: "Biaya layanan tidak valid" }, { status: 400 });
  const account = await updateBiteshipCosts({ areaSearchCost: BigInt(body.data.areaSearchCost), rateQuoteCost: BigInt(body.data.rateQuoteCost), trackingCheckCost: BigInt(body.data.trackingCheckCost), actorId: String(admin.email) });
  return NextResponse.json({ success: true, account: serializeBigInt(account) });
}
