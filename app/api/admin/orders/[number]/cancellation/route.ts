import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { releaseOrderReservation, restockCommittedOrder } from "@/lib/inventory";
import { invalidateCatalogCache } from "@/lib/catalog";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(500),
  cancellationReasonCode: z.string().trim().min(1).max(100).optional(),
});
const handedOverShipmentStates = ["picked", "in_transit", "dropping_off", "delivered", "return_in_transit", "returned"] as const;
const reservationStates = ["awaiting_payment", "awaiting_processing", "processing"] as const;
const committedStates = ["packed", "shipment_booked", "handover_pending"] as const;

class CancellationConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "admin:order-cancellation", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Keputusan tidak valid" }, { status: 400 });
  const { number } = await params;
  const found = await prisma.order.findUnique({ where: { publicNumber: number }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  try {
    if (body.data.decision === "rejected") {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${found.id} FOR UPDATE`);
        const current = await tx.order.findUniqueOrThrow({
          where: { id: found.id },
          include: { cancellations: { where: { state: "requested" }, orderBy: { requestedAt: "desc" }, take: 1 } },
        });
        const cancellation = current.cancellations[0];
        if (!cancellation) throw new CancellationConflictError("Tidak ada pengajuan pembatalan aktif untuk ditolak.");
        const claimed = await tx.cancellationRequest.updateMany({
          where: { id: cancellation.id, state: "requested" },
          data: {
            state: "rejected",
            decisionReason: body.data.reason,
            decidedAt: new Date(),
            decidedBy: String(admin.email),
          },
        });
        if (claimed.count !== 1) throw new CancellationConflictError("Pengajuan pembatalan sudah diproses.");
        const restored = await tx.order.updateMany({
          where: { id: current.id, fulfillmentState: "cancel_requested" },
          data: { fulfillmentState: cancellation.fulfillmentBefore },
        });
        if (restored.count !== 1) throw new CancellationConflictError("Status pesanan berubah. Muat ulang halaman.");
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: String(admin.email),
            action: "cancellation.rejected",
            entityType: "order",
            entityId: current.id,
            after: { reason: body.data.reason },
          },
        });
      });
      return NextResponse.json({ success: true, state: "rejected" });
    }

    // Claim the decision before the provider side effect. `provider_pending` is
    // an existing state and prevents two admin clicks from cancelling twice.
    const claim = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${found.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({
        where: { id: found.id },
        include: {
          cancellations: { orderBy: { requestedAt: "desc" }, take: 1 },
          shipments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (current.fulfillmentState === "cancelled") {
        return { alreadyCancelled: true as const, refundPending: current.paymentState === "refund_pending" };
      }
      const shipment = current.shipments[0];
      if (!shipment && current.fulfillmentState === "shipment_booked") {
        throw new CancellationConflictError("Booking pengiriman sedang diproses. Tunggu hingga data shipment tersinkron lalu coba kembali.");
      }
      if (shipment && (handedOverShipmentStates as readonly string[]).includes(shipment.status)) {
        throw new CancellationConflictError("Paket sudah diserahkan ke kurir; gunakan alur retur");
      }

      const latest = current.cancellations[0];
      const staleProviderClaim = latest?.state === "provider_pending"
        && latest.decidedAt
        && Date.now() - latest.decidedAt.getTime() >= 60_000;
      if (latest?.state === "provider_pending" && !staleProviderClaim) {
        throw new CancellationConflictError("Pembatalan sedang diproses ke penyedia pengiriman.");
      }
      const isRequest = Boolean(latest && (["requested", "provider_failed"].includes(latest.state) || staleProviderClaim));
      let cancellationId: string;
      if (isRequest) {
        const claimed = await tx.cancellationRequest.updateMany({
          where: { id: latest!.id, state: { in: ["requested", "provider_failed", "provider_pending"] } },
          data: { state: "provider_pending", decisionReason: null, decidedAt: new Date(), decidedBy: String(admin.email) },
        });
        if (claimed.count !== 1) throw new CancellationConflictError("Pengajuan pembatalan sudah diproses.");
        cancellationId = latest!.id;
      } else {
        const created = await tx.cancellationRequest.create({
          data: {
            orderId: current.id,
            reason: "Dibatalkan langsung oleh admin",
            state: "provider_pending",
            fulfillmentBefore: current.fulfillmentState,
            decidedAt: new Date(),
            decidedBy: String(admin.email),
          },
        });
        cancellationId = created.id;
      }
      return {
        alreadyCancelled: false as const,
        cancellationId,
        shipmentId: shipment?.id ?? null,
        providerOrderId: shipment?.providerOrderId ?? null,
      };
    });
    if (claim.alreadyCancelled) {
      return NextResponse.json({ success: true, state: "approved", refund_pending: claim.refundPending });
    }

    let providerResult: unknown = undefined;
    if (claim.providerOrderId) {
      if (!process.env.BITESHIP_API_KEY) {
        await markProviderFailure(found.id, claim.cancellationId, "BITESHIP_API_KEY belum diisi", String(admin.email));
        return NextResponse.json({ error: "Layanan pengiriman belum dikonfigurasi" }, { status: 503 });
      }
      if (!body.data.cancellationReasonCode) {
        await markProviderFailure(found.id, claim.cancellationId, "Alasan pembatalan Biteship belum dipilih", String(admin.email));
        return NextResponse.json({ error: "Alasan pembatalan Biteship wajib dipilih" }, { status: 400 });
      }
      const biteship = new BiteshipAdapter(
        process.env.BITESHIP_BASE_URL || "https://api.biteship.com",
        process.env.BITESHIP_API_KEY,
      );
      try {
        providerResult = await biteship.cancelOrder(
          claim.providerOrderId,
          body.data.cancellationReasonCode,
          body.data.reason,
        );
      } catch {
        await markProviderFailure(found.id, claim.cancellationId, "Pembatalan Biteship gagal", String(admin.email));
        return NextResponse.json({
          error: "Pembatalan ke Biteship gagal. Pesanan belum dibatalkan dan dapat dicoba kembali.",
        }, { status: 502 });
      }
    }

    let result: { refundPending: boolean; conflict: string | null };
    try {
      result = await prisma.$transaction(async tx => {
      if (claim.shipmentId) {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Shipment\` WHERE id = ${claim.shipmentId} FOR UPDATE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${found.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({
        where: { id: found.id },
        include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const cancellation = await tx.cancellationRequest.findUniqueOrThrow({ where: { id: claim.cancellationId } });
      if (cancellation.state !== "provider_pending") {
        throw new CancellationConflictError("Pengajuan pembatalan sudah diproses.");
      }
      const currentShipment = current.shipments[0];
      if (currentShipment && (handedOverShipmentStates as readonly string[]).includes(currentShipment.status)) {
        await tx.cancellationRequest.update({
          where: { id: cancellation.id },
          data: { state: "provider_failed", decisionReason: "Status shipment berubah saat pembatalan", decidedAt: new Date(), decidedBy: String(admin.email) },
        });
        return { refundPending: false, conflict: "Status pengiriman berubah; paket sudah diserahkan ke kurir." };
      }

      const inventoryState = cancellation.fulfillmentBefore;
      if ((reservationStates as readonly string[]).includes(inventoryState)) {
        await releaseOrderReservation(tx, current.id, "cancellation_approved");
      } else if ((committedStates as readonly string[]).includes(inventoryState)) {
        await restockCommittedOrder(tx, current.id, "cancellation_approved_before_handover");
      }
      const isPaid = current.paymentState === "paid";
      const requiresRefund = isPaid || current.paymentState === "refund_pending";
      await tx.cancellationRequest.update({
        where: { id: cancellation.id },
        data: {
          state: "approved",
          decisionReason: body.data.reason,
          providerResult: providerResult as Prisma.InputJsonValue | undefined,
          decidedAt: new Date(),
          decidedBy: String(admin.email),
        },
      });
      await tx.order.update({
        where: { id: current.id },
        data: {
          fulfillmentState: "cancelled",
          paymentState: isPaid ? "refund_pending" : current.paymentState,
          issueOrder: current.issueOrder || requiresRefund,
          issueReason: requiresRefund ? (current.issueReason || "cancelled") : current.issueReason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: cancellation.reason === "Dibatalkan langsung oleh admin" ? "order.admin_cancelled" : "cancellation.approved",
          entityType: "order",
          entityId: current.id,
          after: { reason: body.data.reason, refundPending: isPaid },
        },
      });
        return { refundPending: requiresRefund, conflict: null as string | null };
      });
    } catch (error) {
      await markProviderFailure(found.id, claim.cancellationId, "Finalisasi pembatalan lokal gagal", String(admin.email));
      throw error;
    }
    if (result.conflict) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }
    invalidateCatalogCache();
    return NextResponse.json({ success: true, state: "approved", refund_pending: result.refundPending });
  } catch (error) {
    if (error instanceof CancellationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Keputusan pembatalan belum dapat disimpan" }, { status: 500 });
  }
}

async function markProviderFailure(orderId: string, cancellationId: string, reason: string, adminEmail: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`);
    const changed = await tx.cancellationRequest.updateMany({
      where: { id: cancellationId, state: "provider_pending" },
      data: { state: "provider_failed", decisionReason: reason, decidedAt: new Date(), decidedBy: adminEmail },
    });
    if (changed.count === 1) {
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: adminEmail,
          action: "cancellation.provider_failed",
          entityType: "order",
          entityId: orderId,
          after: { message: reason },
        },
      });
    }
  });
}
