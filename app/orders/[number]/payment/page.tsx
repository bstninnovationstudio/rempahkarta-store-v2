import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PaymentPageClient } from "./payment-page-client";
import { customerFromRequest } from "@/lib/customer-auth";
import { turnstileSiteKey } from "@/lib/turnstile";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;

  const customer = await customerFromRequest();
  if (!customer) {
    redirect(`/login?redirect=/orders/${number}/payment`);
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
    notFound();
  }

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) {
    notFound();
  }

  const payment = order.payments[0];
  if (!payment) {
    notFound();
  }

  // Extract QRIS details from raw JSON field if available
  const rawData = payment.raw as { qris?: { image_data_url?: string; qris_string?: string } } | null;
  const qrisDetails = rawData?.qris || null;

  return (
    <PaymentPageClient
      number={number}
      subtotal={Number(order.subtotal)}
      shippingFee={Number(order.shippingFee)}
      serviceFee={Number(order.serviceFee)}
      grandTotal={Number(order.grandTotal)}
      payableAmount={Number(payment.payableAmount || order.grandTotal)}
      feeAmount={Number(payment.feeAmount || 0)}
      expiresAt={payment.expiresAt ? payment.expiresAt.toISOString() : null}
      qrisImageUrl={qrisDetails?.image_data_url || null}
      qrisString={qrisDetails?.qris_string || null}
      initialStatus={payment.status}
      turnstileSiteKey={turnstileSiteKey()}
    />
  );
}
