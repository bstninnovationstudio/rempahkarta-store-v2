import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { getAdminDashboardData } from "@/lib/admin-data";

export async function GET() {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stats } = await getAdminDashboardData();
  return NextResponse.json({
    data: {
      needProcess: stats.needProcess,
      canceledOrders: stats.canceledOrders,
      issueOrders: stats.issueOrders,
      reviewReturns: stats.reviewReturns,
      heldBalance: stats.heldBalance,
      availableBalance: stats.availableBalance,
    },
  });
}

