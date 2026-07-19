import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { releaseOrderReservation, restockCommittedOrder } from "@/lib/inventory";
import { BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { invalidateCatalogCache } from "@/lib/catalog";

const schema = z.object({ reason: z.string().trim().min(3).max(500) });
const handedOverStates = ["handed_over", "completed", "return_in_transit", "returned", "finished"] as const;
const reservationStates = ["awaiting_payment", "awaiting_processing", "processing"] as const;
const committedStates = ["packed", "shipment_booked", "handover_pending"] as const;

class CancellationConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "order:cancel", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  const { number } = await params;

  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      cancellations: { where: { state: "requested" }, take: 1 },
    },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const isOwner = order.userId === customer.id
    || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  if (order.fulfillmentState === "cancelled") return NextResponse.json({ success: true, status: "cancelled" });
  if ((handedOverStates as readonly string[]).includes(order.fulfillmentState)) {
    return NextResponse.json({ error: "Paket sudah diserahkan; gunakan alur retur" }, { status: 409 });
  }

  const payment = order.payments[0];
  const automaticCancellation = order.paymentState === "pending";
  if (automaticCancellation && payment?.providerPaymentId && payment.provider !== "mock") {
    if (!process.env.BSTN_PROJECT_API_KEY || !process.env.BSTN_RETURN_SIGNATURE_SECRET) {
      return NextResponse.json({ error: "Layanan pembayaran belum dikonfigurasi" }, { status: 503 });
    }
    const bstn = new BstnPaymentAdapter(
      process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id",
      process.env.BSTN_PROJECT_API_KEY,
      process.env.BSTN_RETURN_SIGNATURE_SECRET,
    );
    try { await bstn.cancelPayment(payment.providerPaymentId, body.data.reason); }
    catch {
      return NextResponse.json({
        error: "Pembatalan pembayaran gagal. Status pesanan belum diubah; silakan coba kembali.",
      }, { status: 502 });
    }
  }

  try {
    if (automaticCancellation) {
      const result = await prisma.$transaction(async tx => {
        // Payment webhook/sync locks Payment before Order. Use the same lock order
        // to serialize a paid signal racing this cancellation without deadlocks.
        if (payment) {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Payment\` WHERE id = ${payment.id} FOR UPDATE`);
        }
        await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`);
        const [currentOrder, currentPayment] = await Promise.all([
          tx.order.findUniqueOrThrow({ where: { id: order.id } }),
          payment ? tx.payment.findUnique({ where: { id: payment.id } }) : Promise.resolve(null),
        ]);

        if (currentOrder.fulfillmentState === "cancelled") {
          return { status: "cancelled" as const, refundPending: currentOrder.paymentState === "refund_pending", changed: false };
        }
        if ((handedOverStates as readonly string[]).includes(currentOrder.fulfillmentState)) {
          throw new CancellationConflictError("Paket sudah diserahkan; gunakan alur retur");
        }

        const paymentArrived = currentPayment
          ? currentPayment.status === "paid"
          : currentOrder.paymentState === "paid";
        if (currentPayment && ["not_created", "pending"].includes(currentPayment.status)) {
          const cancelled = await tx.payment.updateMany({
            where: { id: currentPayment.id, status: { in: ["not_created", "pending"] } },
            data: { status: "canceled" },
          });
          if (cancelled.count !== 1) {
            throw new CancellationConflictError("Status pembayaran berubah. Silakan muat ulang pesanan.");
          }
        }

        if ((reservationStates as readonly string[]).includes(currentOrder.fulfillmentState)) {
          await releaseOrderReservation(tx, order.id, "customer_cancelled_before_handover");
        } else if ((committedStates as readonly string[]).includes(currentOrder.fulfillmentState)) {
          await restockCommittedOrder(tx, order.id, "customer_cancelled_before_handover");
        }

        const providerTerminalState = currentPayment && [
          "expired", "canceled", "failed", "denied", "refund_pending", "refunded", "partially_refunded",
        ].includes(currentPayment.status) ? currentPayment.status : null;
        const nextPaymentState = paymentArrived
          ? "refund_pending"
          : providerTerminalState ?? (
            ["not_created", "pending"].includes(currentOrder.paymentState)
              ? "canceled"
              : currentOrder.paymentState
          );
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentState: nextPaymentState,
            fulfillmentState: "cancelled",
            ...(paymentArrived ? { issueOrder: true, issueReason: "paid_after_cancel" } : {}),
          },
        });
        await tx.cancellationRequest.create({
          data: {
            orderId: order.id,
            reason: body.data.reason,
            state: "approved",
            fulfillmentBefore: currentOrder.fulfillmentState,
            decisionReason: paymentArrived ? "Pembayaran diterima saat pembatalan; refund wajib diproses" : null,
            decidedAt: new Date(),
            decidedBy: "system",
          },
        });
        await tx.auditLog.create({
          data: {
            actorType: "customer",
            actorId: customer.id,
            action: paymentArrived ? "order.cancelled_paid_race" : "order.cancelled",
            entityType: "order",
            entityId: order.id,
            before: { fulfillmentState: currentOrder.fulfillmentState, paymentState: currentOrder.paymentState },
            after: { fulfillmentState: "cancelled", paymentState: nextPaymentState },
          },
        });
        return { status: "cancelled" as const, refundPending: paymentArrived, changed: true };
      });
      if (result.changed) invalidateCatalogCache();
      return NextResponse.json({ success: true, status: result.status, refund_pending: result.refundPending });
    }

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          cancellations: { where: { state: "requested" }, take: 1 },
          shipments: { take: 1, select: { id: true } },
        },
      });
      if (current.fulfillmentState === "cancelled") return "cancelled" as const;
      if ((handedOverStates as readonly string[]).includes(current.fulfillmentState)) {
        throw new CancellationConflictError("Paket sudah diserahkan; gunakan alur retur");
      }
      if (current.fulfillmentState === "shipment_booked" && current.shipments.length === 0) {
        throw new CancellationConflictError("Booking pengiriman sedang diproses. Coba kembali setelah shipment tersinkron.");
      }
      if (current.cancellations.length) return "cancel_requested" as const;
      await tx.cancellationRequest.create({
        data: { orderId: order.id, reason: body.data.reason, fulfillmentBefore: current.fulfillmentState },
      });
      await tx.order.update({ where: { id: order.id }, data: { fulfillmentState: "cancel_requested" } });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: "cancellation.requested",
          entityType: "order",
          entityId: order.id,
          before: { fulfillmentState: current.fulfillmentState },
          after: { fulfillmentState: "cancel_requested" },
        },
      });
      return "cancel_requested" as const;
    });
    return NextResponse.json({ success: true, status: result });
  } catch (error) {
    if (error instanceof CancellationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Pembatalan belum dapat disimpan" }, { status: 500 });
  }
}
