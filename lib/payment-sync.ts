import { Prisma, type PaymentState } from "@prisma/client";
import { releaseOrderReservation } from "@/lib/inventory";

const failedProviderStatuses = new Set(["expired", "canceled", "failed", "denied"]);
export const authoritativePaidSourceStates = [
  "not_created", "pending", "expired", "canceled", "failed", "denied",
] as const;

export function canApplyAuthoritativePaid(status: PaymentState) {
  return (authoritativePaidSourceStates as readonly PaymentState[]).includes(status);
}

export async function applyVerifiedPaymentStatus(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    orderId: string;
    providerStatus: string;
    paidAt: string | null;
    raw: Prisma.InputJsonValue;
    reservationReason: string;
  },
) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Payment\` WHERE id = ${input.paymentId} FOR UPDATE`);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${input.orderId} FOR UPDATE`);
  const [payment, order] = await Promise.all([
    tx.payment.findUniqueOrThrow({ where: { id: input.paymentId }, select: { status: true } }),
    tx.order.findUniqueOrThrow({ where: { id: input.orderId }, select: { fulfillmentState: true } }),
  ]);
  let transitioned = false;

  if (input.providerStatus === "paid") {
    const changed = await tx.payment.updateMany({
      where: {
        id: input.paymentId,
        status: { in: [...authoritativePaidSourceStates] },
      },
      data: {
        status: "paid",
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        raw: input.raw,
      },
    });
    if (changed.count === 1) {
      transitioned = true;
      const wasCancelled = order.fulfillmentState === "cancelled";
      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paymentState: wasCancelled ? "refund_pending" : "paid",
          ...(order.fulfillmentState === "awaiting_payment"
            ? { fulfillmentState: "awaiting_processing" as const }
            : {}),
          ...(wasCancelled ? { issueOrder: true, issueReason: "paid_after_cancel" } : {}),
        },
      });
    }
  } else if (failedProviderStatuses.has(input.providerStatus)) {
    const terminal = input.providerStatus as Extract<PaymentState, "expired" | "canceled" | "failed" | "denied">;
    const changed = await tx.payment.updateMany({
      where: { id: input.paymentId, status: { in: ["not_created", "pending"] } },
      data: { status: terminal, raw: input.raw },
    });
    if (changed.count === 1) {
      transitioned = true;
      await tx.order.update({ where: { id: input.orderId }, data: { paymentState: terminal } });
      const cancelled = await tx.order.updateMany({
        where: { id: input.orderId, fulfillmentState: { in: ["awaiting_payment", "awaiting_processing"] } },
        data: { fulfillmentState: "cancelled" },
      });
      if (cancelled.count === 1) {
        await releaseOrderReservation(tx, input.orderId, input.reservationReason);
      }
    }
  } else if (input.providerStatus === "refunded" || input.providerStatus === "partially_refunded") {
    const allowed = input.providerStatus === "refunded"
      ? ["paid", "refund_pending", "partially_refunded"] as const
      : ["paid", "refund_pending"] as const;
    const changed = await tx.payment.updateMany({
      where: { id: input.paymentId, status: { in: [...allowed] } },
      data: { status: input.providerStatus, raw: input.raw },
    });
    if (changed.count === 1) {
      transitioned = true;
      await tx.order.update({
        where: { id: input.orderId },
        data: { paymentState: input.providerStatus },
      });
    }
  }

  return { transitioned, previousStatus: payment.status, providerStatus: input.providerStatus };
}
