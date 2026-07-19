import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [ordersTotal, pendingPayments, awaitingProcessing, openReturns, activeShipments, usersTotal, paidRevenue] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { paymentState: "pending" } }),
    prisma.order.count({ where: { fulfillmentState: { in: ["awaiting_processing", "processing"] } } }),
    prisma.returnRequest.count({ where: { state: { notIn: ["rejected", "refunded", "closed", "cancelled", "finished"] } } }),
    prisma.shipment.count({ where: { status: { notIn: ["delivered", "cancelled", "returned", "disposed"] } } }),
    prisma.user.count(),
    prisma.order.aggregate({ where: { paymentState: "paid" }, _sum: { grandTotal: true } }),
  ]);
  return NextResponse.json({
    data: {
      ordersTotal,
      pendingPayments,
      awaitingProcessing,
      openReturns,
      activeShipments,
      usersTotal,
      paidRevenue: Number(paidRevenue._sum.grandTotal || 0),
    },
  });
}

