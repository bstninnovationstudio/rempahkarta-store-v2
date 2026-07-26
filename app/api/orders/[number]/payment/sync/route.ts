import { NextResponse } from "next/server";
import { z } from "zod";
import { BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { prisma } from "@/lib/db";
import { customerFromRequest, assertCustomerActive } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { invalidateCatalogCache } from "@/lib/catalog";
import { applyVerifiedPaymentStatus } from "@/lib/payment-sync";
import { getBstnApiKey } from "@/lib/env";

const schema = z.object({ turnstileToken: z.string().min(1).max(2048) });

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "payment:manual-sync", limit: 15 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userCheck = assertCustomerActive(customer);
  if (userCheck) return userCheck;


  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Verifikasi keamanan wajib disertakan" }, { status: 400 });
  const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "payment_sync");
  if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });

  const { number } = await params;
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const isOwner = order.userId === customer.id
    || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const payment = order.payments[0];
  if (!payment) return NextResponse.json({ error: "Pembayaran tidak ditemukan" }, { status: 404 });
  if (payment.provider === "mock") return NextResponse.json({ success: true, status: payment.status });
  const bstnApiKey = getBstnApiKey();
  if (!payment.providerPaymentId || !bstnApiKey || !process.env.BSTN_RETURN_SIGNATURE_SECRET) {
    return NextResponse.json({ error: "Layanan pembayaran belum dikonfigurasi" }, { status: 503 });
  }

  try {
    const adapter = new BstnPaymentAdapter(
      process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id",
      bstnApiKey,
      process.env.BSTN_RETURN_SIGNATURE_SECRET,
    );
    const detail = await adapter.getPayment(payment.providerPaymentId);
    if (
      detail.data.project_payment_ref !== payment.projectPaymentRef
      || (detail.data.amount !== Number(payment.amount) && detail.data.amount !== Number(payment.payableAmount || 0))
    ) {
      return NextResponse.json({ error: "Data pembayaran tidak cocok" }, { status: 409 });
    }
    const outcome = await prisma.$transaction(async tx => {
      const result = await applyVerifiedPaymentStatus(tx, {
        paymentId: payment.id,
        orderId: order.id,
        providerStatus: detail.data.status,
        paidAt: detail.data.paid_at,
        raw: detail.data,
        reservationReason: `payment_sync_${detail.data.status}`,
      });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: result.transitioned ? "payment.synced" : "payment.sync_ignored",
          entityType: "order",
          entityId: order.id,
          after: { providerStatus: result.providerStatus, previousStatus: result.previousStatus },
        },
      });
      return result;
    });
    if (outcome.transitioned) invalidateCatalogCache();
    return NextResponse.json({ success: true, status: detail.data.status });
  } catch {
    return NextResponse.json({ error: "Sinkronisasi pembayaran gagal" }, { status: 502 });
  }
}
