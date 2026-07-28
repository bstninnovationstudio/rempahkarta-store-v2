import { Prisma, type PaymentState } from "@prisma/client";
import { releaseOrderReservation } from "@/lib/inventory";
import { syncOrderRevenue } from "@/lib/finance";
import { deriveUniqueCode, readBstnUniqueCode } from "@/lib/payment-amounts";
import { enqueuePaidNotification } from "@/lib/whatsapp-notifications";

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
    tx.payment.findUniqueOrThrow({ where: { id: input.paymentId }, select: { status: true, payableAmount: true, feeAmount: true, uniqueCode: true } }),
    tx.order.findUniqueOrThrow({ where: { id: input.orderId }, select: { fulfillmentState: true, grandTotal: true } }),
  ]);
  let transitioned = false;
  let whatsappMessageId: string | null = null;
  const raw = input.raw && typeof input.raw === "object" && !Array.isArray(input.raw)
    ? input.raw as Record<string, unknown>
    : {};
  const qris = raw.qris && typeof raw.qris === "object" && !Array.isArray(raw.qris)
    ? raw.qris as Record<string, unknown>
    : {};
  const payableValue = raw.payable_amount ?? qris.payable_amount;
  const feeValue = raw.fee_amount ?? qris.admin_fee;
  const providerPayable = typeof payableValue === "number" && Number.isFinite(payableValue)
    ? BigInt(Math.round(payableValue))
    : payment.payableAmount;
  const providerFee = typeof feeValue === "number" && Number.isFinite(feeValue)
    ? BigInt(Math.round(feeValue))
    : payment.feeAmount;
  const providerUnique = readBstnUniqueCode(
    raw,
    deriveUniqueCode({ uniqueCode: payment.uniqueCode, payableAmount: providerPayable, grandTotal: order.grandTotal }),
  );
  await tx.payment.update({
    where: { id: input.paymentId },
    data: {
      ...(providerPayable !== null ? { payableAmount: providerPayable } : {}),
      ...(providerFee !== null ? { feeAmount: providerFee } : {}),
      uniqueCode: providerUnique,
    },
  });

  if (input.providerStatus === "paid") {
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    const changed = await tx.payment.updateMany({
      where: {
        id: input.paymentId,
        status: { in: [...authoritativePaidSourceStates] },
      },
      data: {
        status: "paid",
        paidAt,
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
      whatsappMessageId = (await enqueuePaidNotification(tx, {
        orderId: input.orderId,
        paymentId: input.paymentId,
        occurredAt: paidAt,
      }))?.id || null;
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

  await syncOrderRevenue(tx, input.orderId);

  return {
    transitioned,
    previousStatus: payment.status,
    providerStatus: input.providerStatus,
    whatsappMessageId,
  };
}

export async function checkAndExpireOrderTx(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentState: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, expiresAt: true, status: true } },
    },
  });

  if (!order || order.paymentState !== "pending") return false;
  const payment = order.payments[0];
  if (!payment || !payment.expiresAt || payment.expiresAt >= new Date()) return false;

  const outcome = await applyVerifiedPaymentStatus(tx, {
    paymentId: payment.id,
    orderId: order.id,
    providerStatus: "expired",
    paidAt: null,
    raw: { reason: "expired_past_deadline" },
    reservationReason: "expired_past_deadline",
  });

  return outcome.transitioned;
}

export async function checkAndExpireOrder(orderIdOrPublicNumber: string) {
  const { prisma } = await import("@/lib/db");
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderIdOrPublicNumber }, { publicNumber: orderIdOrPublicNumber }],
    },
    select: { id: true, paymentState: true, payments: { orderBy: { createdAt: "desc" }, take: 1, select: { expiresAt: true } } },
  });

  if (!order || order.paymentState !== "pending") return false;
  const payment = order.payments[0];
  if (!payment || !payment.expiresAt || payment.expiresAt >= new Date()) return false;

  let transitioned = false;
  await prisma.$transaction(async (tx) => {
    transitioned = await checkAndExpireOrderTx(tx, order.id);
  });

  if (transitioned) {
    const { invalidateCatalogCache } = await import("@/lib/catalog");
    invalidateCatalogCache();
  }

  return transitioned;
}

export async function checkAndExpireAllStaleOrders() {
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  const staleOrders = await prisma.order.findMany({
    where: {
      paymentState: "pending",
      payments: {
        some: {
          status: { in: ["not_created", "pending"] },
          expiresAt: { lt: now },
        },
      },
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
  });

  if (staleOrders.length === 0) return 0;

  let expiredCount = 0;
  for (const item of staleOrders) {
    try {
      let transitioned = false;
      await prisma.$transaction(async (tx) => {
        transitioned = await checkAndExpireOrderTx(tx, item.id);
      });
      if (transitioned) expiredCount++;
    } catch {
      // Continue processing other stale orders if one fails
    }
  }

  if (expiredCount > 0) {
    const { invalidateCatalogCache } = await import("@/lib/catalog");
    invalidateCatalogCache();
  }

  return expiredCount;
}
