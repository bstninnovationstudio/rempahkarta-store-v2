import { NextResponse } from "next/server";
import { checkAndExpireAllStaleOrders } from "@/lib/payment-sync";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { authorizeCronRequest } from "@/lib/security";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "cron:expire-orders", limit: 10, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const expiredCount = await checkAndExpireAllStaleOrders();
    return NextResponse.json({
      success: true,
      message: `${expiredCount} pesanan kedaluwarsa telah diproses.`,
      expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pembersihan pesanan kedaluwarsa gagal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = GET;
