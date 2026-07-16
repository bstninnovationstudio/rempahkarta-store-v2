import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { customerFromRequest } from "@/lib/customer-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;

  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
