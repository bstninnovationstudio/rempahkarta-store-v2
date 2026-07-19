import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { getProfileCompleteness } from "@/lib/user-profile";

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const where: Prisma.OrderWhereInput = {
    OR: [{ userId: customer.id }, { userId: null, guestEmail: customer.email }],
  };
  const [totalOrders, pendingPayments, spent, completion] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { AND: [where, { paymentState: "pending" }] } }),
    prisma.order.aggregate({
      where: { AND: [where, { OR: [{ paymentState: "paid" }, { fulfillmentState: "completed" }] }] },
      _sum: { grandTotal: true },
    }),
    getProfileCompleteness(customer.id),
  ]);
  return NextResponse.json({
    data: {
      totalOrders,
      pendingPayments,
      totalSpent: Number(spent._sum.grandTotal || 0),
      completion,
    },
  });
}

