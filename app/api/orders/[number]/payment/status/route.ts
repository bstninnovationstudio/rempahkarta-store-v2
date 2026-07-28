import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkAndExpireOrder } from "@/lib/payment-sync";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;

  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(request, {
    scope: "payment:status-poll",
    identity: customer.id,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) return rateLimitResponse(rate);

  const ownedOrder = await prisma.order.findUnique({
    where: { publicNumber: number },
    select: { id: true, userId: true, guestEmail: true },
  });

  if (!ownedOrder) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  const isOwner = ownedOrder.userId === customer.id
    || (ownedOrder.userId === null && ownedOrder.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  await checkAndExpireOrder(ownedOrder.id);

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: ownedOrder.id },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const payment = order.payments[0];
  if (!payment) {
    return NextResponse.json({ error: "Pembayaran tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    status: payment.status,
    paymentState: order.paymentState,
    fulfillmentState: order.fulfillmentState,
  });
}
