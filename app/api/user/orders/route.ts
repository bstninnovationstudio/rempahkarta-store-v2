import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { paginationMeta, readPagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 10, maxPageSize: 50 });
  const where: Prisma.OrderWhereInput = {
    OR: [
      { userId: customer.id },
      { userId: null, guestEmail: customer.email },
    ],
  };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        publicNumber: true,
        createdAt: true,
        grandTotal: true,
        paymentState: true,
        fulfillmentState: true,
        items: { take: 1, select: { nameSnapshot: true, quantity: true } },
      },
    }),
  ]);
  return NextResponse.json({
    data: orders.map(order => ({
      ...order,
      grandTotal: Number(order.grandTotal),
      createdAt: order.createdAt.toISOString(),
    })),
    pagination: paginationMeta(total, page, pageSize),
  });
}

