import { NextResponse } from "next/server";
import { finishExpiredVouchers } from "@/lib/voucher";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { authorizeCronRequest } from "@/lib/security";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "cron:vouchers", limit: 10, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  if (!authorizeCronRequest(request)) return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  try { return NextResponse.json({ success: true, finishedCount: await finishExpiredVouchers(), timestamp: new Date().toISOString() }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Pembaruan voucher gagal" }, { status: 500 }); }
}

export const POST = GET;
