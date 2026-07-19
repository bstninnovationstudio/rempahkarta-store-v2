import { NextResponse } from "next/server";
import type { PaymentState, FulfillmentState, Prisma } from "@prisma/client";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paginationMeta, readPagination } from "@/lib/pagination";

const paymentStates = new Set<PaymentState>(["not_created", "pending", "paid", "expired", "canceled", "failed", "denied", "refund_pending", "refunded", "partially_refunded"]);
const fulfillmentStates = new Set<FulfillmentState>(["awaiting_payment", "awaiting_processing", "processing", "packed", "shipment_booked", "handover_pending", "handed_over", "completed", "cancel_requested", "cancelled", "return_requested", "return_in_transit", "returned", "finished"]);

function maskName(value: string) {
  const [first, ...rest] = value.trim().split(/\s+/);
  return [first, ...rest.map(part => `${part.slice(0, 1)}•••`)].filter(Boolean).join(" ");
}

export async function GET(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 20, maxPageSize: 100 });
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const payment = url.searchParams.get("paymentState") as PaymentState | null;
  const fulfillment = url.searchParams.get("fulfillmentState") as FulfillmentState | null;
  const issue = url.searchParams.get("issue");
  const where: Prisma.OrderWhereInput = {
    ...(q ? { OR: [{ publicNumber: { contains: q } }, { guestName: { contains: q } }, { guestEmail: { contains: q } }] } : {}),
    ...(payment && paymentStates.has(payment) ? { paymentState: payment } : {}),
    ...(fulfillment && fulfillmentStates.has(fulfillment) ? { fulfillmentState: fulfillment } : {}),
    ...(issue === "true" || issue === "false" ? { issueOrder: issue === "true" } : {}),
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
        guestName: true,
        grandTotal: true,
        paymentState: true,
        fulfillmentState: true,
        issueOrder: true,
        createdAt: true,
        items: { take: 1, select: { nameSnapshot: true, quantity: true } },
        shipments: { orderBy: { createdAt: "desc" }, take: 1, select: { courierCompany: true, courierType: true, status: true } },
      },
    }),
  ]);
  return NextResponse.json({
    data: orders.map(order => ({
      ...order,
      guestName: maskName(order.guestName),
      grandTotal: Number(order.grandTotal),
      createdAt: order.createdAt.toISOString(),
    })),
    pagination: paginationMeta(total, page, pageSize),
  });
}

