import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { isDemo, isPaymentMock, warehouseAreaId } from "@/lib/env";
import { releaseOrderReservation } from "@/lib/inventory";
import { createOrderWithReservation } from "@/lib/repositories/order-repository";
import { verifyTurnstile } from "@/lib/turnstile";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getProfileCompleteness } from "@/lib/user-profile";
import { invalidateCatalogCache } from "@/lib/catalog";

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
  acceptPolicies: z.literal(true),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "checkout:order-create", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  try {
    const customer = await customerFromRequest();
    if (!customer) return NextResponse.json({ error: "Silakan login terlebih dahulu untuk checkout." }, { status: 401 });
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
    if (isDemo()) return NextResponse.json({ success: true, order_number: "ORD-20260713-8F3K", payment_page_url: "/orders/ORD-20260713-8F3K" });
    if (!process.env.BITESHIP_API_KEY) return NextResponse.json({ error: "Layanan pengiriman belum dikonfigurasi" }, { status: 503 });
    let base = process.env.APP_URL?.trim();
    if (!base && process.env.NODE_ENV !== "production") {
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
      const proto = request.headers.get("x-forwarded-proto") || "http";
      base = `${proto}://${host}`;
    }
    if (!base) return NextResponse.json({ error: "APP_URL belum dikonfigurasi" }, { status: 503 });
    let baseUrl: URL;
    try { baseUrl = new URL(base); }
    catch { return NextResponse.json({ error: "APP_URL tidak valid" }, { status: 503 }); }
    if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
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
    const biteship = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", process.env.BITESHIP_API_KEY);
    const rates = await biteship.rates({ originAreaId: warehouseAreaId(), originPostalCode: Number(process.env.WAREHOUSE_POSTAL_CODE) || undefined, destinationAreaId: parsed.data.areaId, destinationPostalCode: Number(parsed.data.postalCode), couriers: process.env.ENABLED_COURIERS || "jne", items: shippingItems });
    const selected = rates.pricing.find(rate => rate.company === parsed.data.shipping.company && rate.courier_type === parsed.data.shipping.type);
    if (!selected) return NextResponse.json({ error: "Layanan pengiriman sudah tidak tersedia. Silakan cek ongkir kembali." }, { status: 409 });
    const currentShipping = { company: selected.company, type: selected.courier_type, name: `${selected.courier_name} ${selected.courier_service_name}`.trim(), price: selected.price, eta: `${selected.shipment_duration_range} ${selected.shipment_duration_unit}`, collectionMethods: selected.available_collection_method };
    if (selected.price !== parsed.data.shipping.price) return NextResponse.json({ error: `Ongkir berubah dari Rp${parsed.data.shipping.price.toLocaleString("id-ID")} menjadi Rp${selected.price.toLocaleString("id-ID")}. Silakan tinjau dan setujui total baru.`, code: "SHIPPING_PRICE_CHANGED", shipping: currentShipping }, { status: 409 });

    const { turnstileToken: _token, acceptPolicies: _policies, ...customerInput } = parsed.data;
    void _token; void _policies;
    const { order } = await createOrderWithReservation({ ...customerInput, userId: customer.id, shipping: currentShipping });
    // Reservation changes sellable stock before the payment provider call. Purge
    // immediately so a provider timeout/process crash cannot leave a stale
    // storefront catalog for the full cache window.
    invalidateCatalogCache();
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });

    const isLiveKey = process.env.BSTN_PROJECT_API_KEY?.startsWith("bstn_live_");
    if (isLiveKey && base.startsWith("http://") && !base.includes("localhost") && !base.includes("127.0.0.1")) {
      base = base.replace("http://", "https://");
    }


    try {
      if (isPaymentMock()) {
        const paid = process.env.PAYMENT_MOCK_AUTO_PAID === "true";
        const paymentPageUrl = paid ? `${base}/orders/${order.publicNumber}` : `${base}/orders/${order.publicNumber}/mock-payment`;
        await prisma.$transaction([
          prisma.payment.create({ data: { orderId: order.id, provider: "mock", providerPaymentId: `mock_${order.id}`, projectPaymentRef: order.publicNumber, amount: order.grandTotal, payableAmount: order.grandTotal, feeAmount: 0, status: paid ? "paid" : "pending", paymentPageUrl, paidAt: paid ? new Date() : undefined, raw: { mock: true, autoPaid: paid } } }),
          prisma.order.update({ where: { id: order.id }, data: { paymentState: paid ? "paid" : "pending", fulfillmentState: paid ? "awaiting_processing" : "awaiting_payment" } }),
          prisma.auditLog.create({ data: { actorType: "system", action: paid ? "payment.mock_paid" : "payment.mock_created", entityType: "order", entityId: order.id, after: { autoPaid: paid } } }),
        ]);
        invalidateCatalogCache();
        return NextResponse.json({ success: true, order_number: order.publicNumber, payment_page_url: paymentPageUrl, mock: true });
      }
      if (!process.env.BSTN_PROJECT_API_KEY || !process.env.BSTN_RETURN_SIGNATURE_SECRET) throw new Error("Konfigurasi pembayaran BSTN belum lengkap");
      const bstn = new BstnPaymentAdapter(process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id", process.env.BSTN_PROJECT_API_KEY, process.env.BSTN_RETURN_SIGNATURE_SECRET);
      const result = await bstn.createPayment({ reference: order.publicNumber, amount: Number(order.grandTotal), description: `Pembayaran ${order.publicNumber}`, customer: { name: order.guestName, email: order.guestEmail, phone: order.guestPhone }, items: [...items.map(item => ({ id: item.skuSnapshot, name: item.nameSnapshot, price: Number(item.unitPrice), quantity: item.quantity })), { id: "SHIPPING", name: `Biaya Pengiriman - ${currentShipping.name}`, price: currentShipping.price, quantity: 1 }], finishUrl: `${base}/orders/${order.publicNumber}`, webhookUrl: `${base}/api/webhooks/bstn`, expiryMinutes: 10 });
      const localPaymentUrl = `${base}/orders/${order.publicNumber}/payment`;
      await prisma.$transaction([
        prisma.payment.create({ data: { orderId: order.id, providerPaymentId: result.data.payment_id, projectPaymentRef: order.publicNumber, amount: order.grandTotal, payableAmount: BigInt(result.data.payable_amount), feeAmount: BigInt(result.data.fee_amount), status: "pending", paymentPageUrl: localPaymentUrl, expiresAt: new Date(result.data.expires_at), raw: result.data as unknown as Prisma.InputJsonValue } }),
        prisma.order.update({ where: { id: order.id }, data: { paymentState: "pending" } }),
      ]);
      invalidateCatalogCache();
      return NextResponse.json({ success: true, order_number: order.publicNumber, payment_page_url: localPaymentUrl });
    } catch (cause) {
      await prisma.$transaction(async tx => {
        await tx.order.update({ where: { id: order.id }, data: { paymentState: "failed", fulfillmentState: "cancelled" } });
        await releaseOrderReservation(tx, order.id, "payment_creation_failed");
        await tx.auditLog.create({ data: { actorType: "system", action: "payment.create_failed", entityType: "order", entityId: order.id, after: { message: cause instanceof Error ? cause.message : "Payment error" } } });
      });
      invalidateCatalogCache();
      return NextResponse.json({ error: cause instanceof Error && cause.message.includes("belum lengkap") ? cause.message : "Pembayaran belum dapat dibuat. Silakan ulangi." }, { status: cause instanceof Error && cause.message.includes("belum lengkap") ? 503 : 502 });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Checkout gagal";
    const status = /stok|varian|produk tidak tersedia|berubah/i.test(message) ? 409 : /Biteship|courier|rate|pengiriman/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: status === 500 ? "Checkout belum dapat diproses. Silakan coba kembali." : message }, { status });
  }
}
