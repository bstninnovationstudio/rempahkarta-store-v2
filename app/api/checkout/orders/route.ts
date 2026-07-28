import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { BstnApiError, BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { buildBstnItems } from "@/lib/bstn-items";
import { isProduction, getAppUrl, getBstnApiKey, getBiteshipApiKey, warehouseAreaId, getWebhookBaseUrl } from "@/lib/env";
import { releaseOrderReservation } from "@/lib/inventory";
import { createOrderWithReservation } from "@/lib/repositories/order-repository";
import { verifyTurnstile } from "@/lib/turnstile";
import { customerFromRequest, assertCustomerActive, assertStoreOperational } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getProfileCompleteness } from "@/lib/user-profile";
import { invalidateCatalogCache } from "@/lib/catalog";
import { BiteshipBalanceError, reserveBiteshipFunds, reverseBiteshipFunds } from "@/lib/finance";
import { readBstnUniqueCode } from "@/lib/payment-amounts";

const schema = z.object({
  turnstileToken: z.string().min(1).max(2048),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(8).max(20).regex(/^[0-9+() -]+$/),
  address: z.string().trim().min(10).max(1000),
  postalCode: z.string().regex(/^\d{5}$/),
  areaId: z.string().min(3).max(150),
  shipping: z.object({ company: z.string().min(2).max(40), type: z.string().min(1).max(60), name: z.string().min(2).max(100), price: z.number().int().nonnegative(), eta: z.string().max(120).optional() }),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().positive().max(20) })).min(1).max(20),
  voucherCode: z.string().trim().min(3).max(50).optional(),
  acceptPolicies: z.literal(true),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "checkout:order-create", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  try {
    const storeCheck = await assertStoreOperational();
    if (storeCheck) return storeCheck;
    const customer = await customerFromRequest();
    if (!customer) return NextResponse.json({ error: "Silakan login terlebih dahulu untuk checkout." }, { status: 401 });
    const userActiveCheck = assertCustomerActive(customer);
    if (userActiveCheck) return userActiveCheck;
    const completion = await getProfileCompleteness(customer.id);
    if (!completion.isComplete) {
      return NextResponse.json(
        { error: "Lengkapi kontak, minimal satu alamat, dan rekening pengembalian dana sebelum membuat pesanan.", code: "PROFILE_INCOMPLETE", completion },
        { status: 409 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data checkout tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "checkout_order");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });

    const biteshipApiKey = getBiteshipApiKey();
    if (!biteshipApiKey) return NextResponse.json({ error: "Layanan pengiriman belum dikonfigurasi" }, { status: 503 });

    let base = getAppUrl()?.trim();
    if (!base && !isProduction()) {
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
      const proto = request.headers.get("x-forwarded-proto") || "http";
      base = `${proto}://${host}`;
    }
    if (!base) return NextResponse.json({ error: "APP_URL belum dikonfigurasi" }, { status: 503 });
    let baseUrl: URL;
    try { baseUrl = new URL(base); }
    catch { return NextResponse.json({ error: "APP_URL tidak valid" }, { status: 503 }); }
    if (isProduction() && baseUrl.protocol !== "https:") {
      return NextResponse.json({ error: "APP_URL production wajib menggunakan HTTPS" }, { status: 503 });
    }
    base = baseUrl.origin.replace(/\/$/, "");

    const { prisma } = await import("@/lib/db");
    const variantIds = parsed.data.items.map(item => item.variantId);
    if (new Set(variantIds).size !== variantIds.length) return NextResponse.json({ error: "Varian yang sama tidak boleh dikirim dua kali" }, { status: 400 });
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds }, active: true, product: { status: "active" } }, include: { product: true } });
    if (variants.length !== parsed.data.items.length) return NextResponse.json({ error: "Salah satu produk atau varian tidak tersedia" }, { status: 409 });
    const shippingItems = parsed.data.items.map(item => {
      const variant = variants.find(candidate => candidate.id === item.variantId)!;
      return { name: variant.product.name, description: [variant.option1Value, variant.option2Value].filter(Boolean).join(" / ") || undefined, category: "food_and_drink", sku: variant.sku, value: Number(variant.price), quantity: item.quantity, weight: variant.weight, length: variant.length || undefined, width: variant.width || undefined, height: variant.height || undefined };
    });
    const biteship = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", biteshipApiKey);
    const enabledCouriers = (process.env.ENABLED_COURIERS || "jne,sicepat,anteraja,jnt").split(",").map(c => c.trim().toLowerCase()).filter(Boolean).join(",");
    const rateReservation = await reserveBiteshipFunds({
      kind: "rate",
      referenceId: customer.id,
      notes: `Validasi ulang ongkir checkout oleh pelanggan ${customer.id}`,
    });
    let rates;
    try {
      rates = await biteship.rates({ originAreaId: warehouseAreaId(), originPostalCode: Number(process.env.WAREHOUSE_POSTAL_CODE) || undefined, destinationAreaId: parsed.data.areaId, destinationPostalCode: Number(parsed.data.postalCode), couriers: enabledCouriers, items: shippingItems });
    } catch (cause) {
      await reverseBiteshipFunds(rateReservation, "Validasi ulang ongkir checkout gagal");
      throw cause;
    }
    const selected = rates.pricing.find(rate => rate.company === parsed.data.shipping.company && rate.courier_type === parsed.data.shipping.type);
    if (!selected) return NextResponse.json({ error: "Layanan pengiriman sudah tidak tersedia. Silakan cek ongkir kembali." }, { status: 409 });
    const currentShipping = { company: selected.company, type: selected.courier_type, name: `${selected.courier_name} ${selected.courier_service_name}`.trim(), price: selected.price, eta: `${selected.shipment_duration_range} ${selected.shipment_duration_unit}`, collectionMethods: selected.available_collection_method };
    if (selected.price !== parsed.data.shipping.price) return NextResponse.json({ error: `Ongkir berubah dari Rp${parsed.data.shipping.price.toLocaleString("id-ID")} menjadi Rp${selected.price.toLocaleString("id-ID")}. Silakan tinjau dan setujui total baru.`, code: "SHIPPING_PRICE_CHANGED", shipping: currentShipping }, { status: 409 });

    const { turnstileToken: _token, acceptPolicies: _policies, ...customerInput } = parsed.data;
    void _token; void _policies;
    const { order } = await createOrderWithReservation({ ...customerInput, userId: customer.id, shipping: currentShipping });
    invalidateCatalogCache();
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });

    const bstnApiKey = getBstnApiKey();
    const webhookBase = getWebhookBaseUrl();
    const webhookUrl = `${webhookBase}/api/webhooks/bstn`;
    const finishUrl = `${webhookBase}/orders/${order.publicNumber}`;

    let paymentIntentId: string | null = null;
    let providerCallStarted = false;
    const localPaymentUrl = `${base}/orders/${order.publicNumber}/payment`;
    try {
      if (!bstnApiKey || !process.env.BSTN_RETURN_SIGNATURE_SECRET) throw new Error("Konfigurasi pembayaran BSTN belum lengkap");
      const { calculateServiceFee } = await import("@/lib/fee");
      const feeBreakdown = calculateServiceFee(Number(order.subtotal + order.shippingFee - order.discountAmount));
      const bstn = new BstnPaymentAdapter(process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id", bstnApiKey, process.env.BSTN_RETURN_SIGNATURE_SECRET);
      const bstnItems = buildBstnItems({
        productItems: items.map(item => ({ id: item.skuSnapshot, name: item.nameSnapshot, price: Number(item.unitPrice), quantity: item.quantity })),
        shippingItem: { id: "SHIPPING", name: `Biaya Pengiriman - ${currentShipping.name}`, price: currentShipping.price, quantity: 1 },
        discountAmount: Number(order.discountAmount),
        target: order.voucherTarget,
        serviceFee: feeBreakdown.fixedFee,
      });
      const provisionalExpiry = new Date(Date.now() + 10 * 60_000);
      const paymentIntent = await prisma.$transaction(async tx => {
        const created = await tx.payment.create({
          data: {
            orderId: order.id,
            projectPaymentRef: order.publicNumber,
            amount: BigInt(feeBreakdown.bstnAmount),
            status: "not_created",
            paymentPageUrl: localPaymentUrl,
            expiresAt: provisionalExpiry,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { paymentState: "pending" },
        });
        await tx.auditLog.create({
          data: {
            actorType: "system",
            action: "payment.intent_created",
            entityType: "order",
            entityId: order.id,
            after: { projectPaymentRef: order.publicNumber },
          },
        });
        return created;
      });
      paymentIntentId = paymentIntent.id;
      providerCallStarted = true;
      const result = await bstn.createPayment({ reference: order.publicNumber, amount: feeBreakdown.bstnAmount, description: `Pembayaran ${order.publicNumber}`, customer: { name: order.guestName, email: order.guestEmail, phone: order.guestPhone }, items: bstnItems, finishUrl, webhookUrl, expiryMinutes: 10 });
      if (
        !result.data?.payment_id
        || !Number.isFinite(result.data.payable_amount)
        || !Number.isFinite(result.data.fee_amount)
        || !Number.isFinite(new Date(result.data.expires_at).getTime())
      ) {
        throw new Error("Respons pembuatan pembayaran BSTN tidak lengkap");
      }
      await prisma.$transaction([
        prisma.payment.update({ where: { id: paymentIntent.id }, data: { providerPaymentId: result.data.payment_id, payableAmount: BigInt(result.data.payable_amount), feeAmount: BigInt(result.data.fee_amount), uniqueCode: readBstnUniqueCode(result.data, Math.max(0, result.data.payable_amount - Number(order.grandTotal))), status: "pending", expiresAt: new Date(result.data.expires_at), raw: result.data as unknown as Prisma.InputJsonValue } }),
        prisma.order.update({ where: { id: order.id }, data: { paymentState: "pending" } }),
      ]);
      invalidateCatalogCache();
      return NextResponse.json({ success: true, order_number: order.publicNumber, payment_page_url: localPaymentUrl });
    } catch (cause) {
      const configurationFailure = cause instanceof Error && cause.message.includes("Konfigurasi pembayaran BSTN belum lengkap");
      const errorMessage = cause instanceof BstnApiError
        ? `BSTN menolak pembuatan pembayaran dengan HTTP ${cause.status}`
        : cause instanceof Error ? cause.message : "Pembayaran belum dapat dibuat. Silakan ulangi.";
      const providerRejected = cause instanceof BstnApiError
        && cause.status >= 400
        && cause.status < 500
        && ![408, 409, 425, 429].includes(cause.status);
      const definitiveFailure = !providerCallStarted || providerRejected;
      if (!definitiveFailure && paymentIntentId) {
        try {
          await prisma.$transaction([
            prisma.payment.update({
              where: { id: paymentIntentId },
              data: { status: "pending" },
            }),
            prisma.order.update({
              where: { id: order.id },
              data: { paymentState: "pending" },
            }),
            prisma.auditLog.create({
              data: {
                actorType: "system",
                action: "payment.create_ambiguous",
                entityType: "order",
                entityId: order.id,
                after: { message: errorMessage.slice(0, 500), retryableByWebhook: true },
              },
            }),
          ]);
        } catch (persistError) {
          console.error("[Checkout Payment Ambiguous Persist Error]", persistError);
        }
        invalidateCatalogCache();
        return NextResponse.json({
          success: true,
          pending_confirmation: true,
          order_number: order.publicNumber,
          payment_page_url: localPaymentUrl,
        }, { status: 202 });
      }
      await prisma.$transaction(async tx => {
        if (paymentIntentId) {
          await tx.payment.updateMany({
            where: { id: paymentIntentId, status: { in: ["not_created", "pending"] } },
            data: { status: "failed" },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: { paymentState: "failed", fulfillmentState: "cancelled" } });
        if (order.voucherId) {
          const usage = await tx.voucherUsage.deleteMany({ where: { orderId: order.id } });
          if (usage.count) await tx.voucher.update({ where: { id: order.voucherId }, data: { totalUsage: { decrement: 1 } } });
        }
        await releaseOrderReservation(tx, order.id, "payment_creation_failed");
        await tx.auditLog.create({ data: { actorType: "system", action: "payment.create_failed", entityType: "order", entityId: order.id, after: { message: errorMessage } } });
      });
      invalidateCatalogCache();
      return NextResponse.json(
        { error: configurationFailure ? "Konfigurasi pembayaran BSTN belum lengkap" : "Pembayaran belum dapat dibuat. Silakan ulangi." },
        { status: configurationFailure ? 503 : 502 },
      );
    }
  } catch (cause) {
    console.error("[Checkout API Error]", cause);
    if (cause instanceof BiteshipBalanceError) {
      return NextResponse.json({ error: "Permintaan tidak dapat diproses" }, { status: 409 });
    }
    const message = cause instanceof Error ? cause.message : "Checkout gagal";
    const status = /stok|varian|produk tidak tersedia|berubah/i.test(message) ? 409 : /Biteship|courier|rate|pengiriman/i.test(message) ? 502 : 500;
    const errorResponse = isProduction()
      ? (status === 500 ? "Checkout belum dapat diproses. Silakan coba kembali." : message)
      : (cause instanceof Error ? `${message} (${cause.stack || ""})` : message);
    return NextResponse.json({ error: errorResponse }, { status });
  }
}
