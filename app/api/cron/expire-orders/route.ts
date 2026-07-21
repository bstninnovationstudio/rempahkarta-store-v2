import { NextResponse } from "next/server";
import { checkAndExpireAllStaleOrders } from "@/lib/payment-sync";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const headerSecret = request.headers.get("x-cron-secret");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (bearerToken !== cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }
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
