import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { getProfileCompleteness } from "@/lib/user-profile";
import { getCustomerPaidTotal } from "@/lib/payment-totals";

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const where: Prisma.OrderWhereInput = {
    OR: [{ userId: customer.id }, { userId: null, guestEmail: customer.email }],
  };
  const [totalOrders, pendingPayments, spent, completion] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { AND: [where, { paymentState: "pending" }] } }),
    getCustomerPaidTotal(customer.id, customer.email),
    getProfileCompleteness(customer.id),
  ]);
  return NextResponse.json({
    data: {
      totalOrders,
      pendingPayments,
      totalSpent: Number(spent),
      completion,
    },
  });
}
