import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BiteshipAdapter, normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { serializeBigInt } from "@/lib/serialize";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  collectionMethod: z.enum(["pickup", "drop_off"]),
  deliveryType: z.enum(["now", "scheduled"]),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliveryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).superRefine((value, context) => {
  if (value.deliveryType === "scheduled" && (!value.deliveryDate || !value.deliveryTime)) {
    context.addIssue({ code: "custom", path: ["deliveryDate"], message: "Tanggal dan waktu wajib untuk pengiriman terjadwal" });
  }
});

const CLAIM_TTL_MS = 60_000;
class BookingConflictError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "admin:shipment-book", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Payload tidak valid", details: body.error.flatten() }, { status: 400 });
  if (!process.env.BITESHIP_API_KEY) return NextResponse.json({ error: "Layanan pengiriman belum dikonfigurasi" }, { status: 503 });

  const { number } = await params;
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      items: true,
      addresses: true,
      quotes: { where: { selectedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
  const destination = order.addresses.find(address => address.type === "shipping");
  const quote = order.quotes[0];
  if (!warehouse || !destination || !quote) {
    return NextResponse.json({ error: "Data pengiriman belum lengkap" }, { status: 409 });
  }
  const allowed = Array.isArray(quote.collectionMethods) ? quote.collectionMethods.map(String) : ["pickup"];
  if (!allowed.includes(body.data.collectionMethod)) {
    return NextResponse.json({ error: `Metode ${body.data.collectionMethod} tidak tersedia untuk layanan ini` }, { status: 409 });
  }

  try {
    const claim = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`);
      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (current.shipments[0]) return { existing: current.shipments[0], claimed: false };
      if (current.paymentState !== "paid") {
        throw new BookingConflictError("Pengiriman hanya dapat dibooking setelah pembayaran terverifikasi");
      }
      if (current.fulfillmentState === "shipment_booked") {
        if (Date.now() - current.updatedAt.getTime() < CLAIM_TTL_MS) {
          throw new BookingConflictError("Booking pengiriman sedang diproses. Tunggu sebentar lalu muat ulang halaman.");
        }
        // Recover a claim left by a crashed/timeout request. The fixed provider
        // reference below makes the retry idempotent and reconciles duplicates.
        await tx.order.update({ where: { id: current.id }, data: { fulfillmentState: "shipment_booked" } });
      } else {
        const changed = await tx.order.updateMany({
          where: { id: current.id, fulfillmentState: "packed", paymentState: "paid" },
          data: { fulfillmentState: "shipment_booked" },
        });
        if (changed.count !== 1) {
          throw new BookingConflictError("Pesanan harus ditandai sudah dikemas sebelum booking pengiriman");
        }
      }
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "shipment.booking_started",
          entityType: "order",
          entityId: current.id,
          after: { collectionMethod: body.data.collectionMethod },
        },
      });
      return { existing: null, claimed: true };
    });
    if (!claim.claimed && claim.existing) {
      return NextResponse.json({ success: true, shipment: serializeBigInt(claim.existing) });
    }

    const adapter = new BiteshipAdapter(
      process.env.BITESHIP_BASE_URL || "https://api.biteship.com",
      process.env.BITESHIP_API_KEY,
    );
    const reference = `SHP-${order.publicNumber}`;
    let providerResult;
    try {
      providerResult = await adapter.createOrder({
        reference_id: reference,
        shipper_contact_name: warehouse.contactName,
        shipper_contact_phone: warehouse.contactPhone,
        shipper_organization: "REMPAHKARTA",
        origin_contact_name: warehouse.contactName,
        origin_contact_phone: warehouse.contactPhone,
        origin_address: warehouse.address,
        origin_postal_code: Number(warehouse.postalCode),
        origin_area_id: warehouse.areaId,
        origin_collection_method: body.data.collectionMethod,
        destination_contact_name: destination.contactName,
        destination_contact_phone: destination.contactPhone,
        destination_contact_email: destination.contactEmail,
        destination_address: destination.address,
        destination_note: destination.note,
        destination_postal_code: Number(destination.postalCode),
        destination_area_id: destination.areaId,
        courier_company: quote.courierCompany,
        courier_type: quote.courierType,
        delivery_type: body.data.deliveryType,
        delivery_date: body.data.deliveryDate,
        delivery_time: body.data.deliveryTime,
        metadata: { order_number: order.publicNumber },
        items: order.items.map(item => ({
          name: item.nameSnapshot,
          description: Object.values(item.optionsSnapshot as Record<string, string>).filter(Boolean).join(" / "),
          category: "food_and_drink",
          sku: item.skuSnapshot,
          value: Number(item.unitPrice),
          quantity: item.quantity,
          weight: item.weight,
          length: item.length,
          width: item.width,
          height: item.height,
        })),
      });
    } catch {
      await releaseBookingClaim(order.id, String(admin.email), "Provider booking failed");
      return NextResponse.json({ error: "Booking Biteship gagal. Silakan coba kembali." }, { status: 502 });
    }

    const priceCandidate = providerResult.price ?? Number(quote.price);
    if (!Number.isSafeInteger(priceCandidate) || priceCandidate < 0) {
      await releaseBookingClaim(order.id, String(admin.email), "Invalid provider price");
      return NextResponse.json({ error: "Nilai ongkir dari provider tidak valid. Silakan coba kembali." }, { status: 502 });
    }
    const actual = BigInt(priceCandidate);
    const status = normalizeBiteshipStatus(providerResult.status);
    const rawResult = JSON.parse(JSON.stringify(providerResult)) as Prisma.InputJsonValue;
    const payloadHash = await sha256(JSON.stringify(rawResult));
    try {
      const shipment = await prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`);
        const current = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
        if (current.shipments[0]) return current.shipments[0];
        if (current.fulfillmentState !== "shipment_booked" || current.paymentState !== "paid") {
          throw new BookingConflictError("Status pesanan berubah selama booking. Muat ulang halaman.");
        }
        const created = await tx.shipment.create({
          data: {
            orderId: order.id,
            warehouseId: warehouse.id,
            providerOrderId: providerResult.id,
            referenceId: reference,
            trackingId: providerResult.courier?.tracking_id || null,
            waybillId: providerResult.courier?.waybill_id || null,
            courierCompany: quote.courierCompany,
            courierType: quote.courierType,
            collectionMethod: body.data.collectionMethod,
            quotedPrice: quote.price,
            actualPrice: actual,
            priceAdjustment: actual - quote.price,
            status,
            raw: rawResult,
          },
        });
        await tx.shipmentTrackingEvent.create({
          data: {
            shipmentId: created.id,
            providerStatus: status,
            note: "Pesanan memasuki proses pengiriman.",
            occurredAt: new Date(),
            payloadHash,
            payload: rawResult,
          },
        });
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: String(admin.email),
            action: "shipment.booked",
            entityType: "shipment",
            entityId: created.id,
            after: {
              status,
              collectionMethod: body.data.collectionMethod,
              waybillId: providerResult.courier?.waybill_id,
              quotedPrice: quote.price.toString(),
              actualPrice: actual.toString(),
            },
          },
        });
        return created;
      });
      return NextResponse.json({ success: true, shipment: serializeBigInt(shipment) });
    } catch (error) {
      await releaseBookingClaim(order.id, String(admin.email), "Local booking finalization failed");
      if (error instanceof BookingConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({
        error: "Booking provider berhasil tetapi penyimpanan lokal perlu direkonsiliasi. Coba kembali dengan referensi pesanan yang sama.",
      }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Booking pengiriman belum dapat diproses" }, { status: 500 });
  }
}

async function releaseBookingClaim(orderId: string, adminEmail: string, reason: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`);
    const existing = await tx.shipment.count({ where: { orderId } });
    if (existing > 0) return;
    const released = await tx.order.updateMany({
      where: { id: orderId, fulfillmentState: "shipment_booked" },
      data: { fulfillmentState: "packed" },
    });
    if (released.count === 1) {
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: adminEmail,
          action: "shipment.booking_failed",
          entityType: "order",
          entityId: orderId,
          after: { reason },
        },
      });
    }
  });
}
