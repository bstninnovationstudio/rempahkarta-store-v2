import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BiteshipAdapter, normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { serializeBigInt } from "@/lib/serialize";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getBiteshipApiKey } from "@/lib/env";

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
  const apiKey = getBiteshipApiKey();
  if (!apiKey) return NextResponse.json({ error: "Layanan pengiriman belum dikonfigurasi" }, { status: 503 });

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
  if (order.fulfillmentState === "cancelled") return NextResponse.json({ error: "Pesanan sudah dibatalkan" }, { status: 409 });
  if (order.paymentState !== "paid") return NextResponse.json({ error: "Pesanan belum lunas" }, { status: 409 });

  const quote = order.quotes[0];
  const shippingAddr = order.addresses.find(item => item.type === "shipping");
  if (!quote || !shippingAddr) return NextResponse.json({ error: "Data pengiriman pesanan belum lengkap" }, { status: 409 });

  const warehouse = (await prisma.warehouse.findFirst({ where: { isDefault: true } })) || (await prisma.warehouse.findFirst());
  if (!warehouse) return NextResponse.json({ error: "Gudang default belum dikonfigurasi" }, { status: 500 });

  const shippingItems = order.items.map(item => ({
    name: item.nameSnapshot,
    description: Object.values(item.optionsSnapshot as Record<string, string>).filter(Boolean).join(" / ") || undefined,
    category: "food_and_drink",
    sku: item.skuSnapshot,
    value: Number(item.unitPrice),
    quantity: item.quantity,
    weight: item.weight,
    length: item.length || undefined,
    width: item.width || undefined,
    height: item.height || undefined,
  }));

  try {
    const claim = await prisma.$transaction(async tx => {
      const existing = await tx.shipment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
      if (existing) {
        const isTransient = ["booking_claimed", "booking_failed"].includes(existing.status);
        const expired = existing.updatedAt.getTime() + CLAIM_TTL_MS < Date.now();
        if (!isTransient || !expired) return { existing, claimed: false };
        await tx.shipment.update({ where: { id: existing.id }, data: { status: "booking_claimed" } });
        return { existing: null, claimed: true };
      }

      await tx.shipment.create({
        data: {
          orderId: order.id,
          warehouseId: warehouse.id,
          providerOrderId: `claim_${crypto.randomUUID()}`,
          referenceId: `SHP-${order.publicNumber}`,
          trackingId: `claim_${crypto.randomUUID()}`,
          courierCompany: quote.courierCompany,
          courierType: quote.courierType,
          collectionMethod: body.data.collectionMethod,
          quotedPrice: quote.price,
          actualPrice: quote.price,
          status: "booking_claimed",
        },
      });
      return { existing: null, claimed: true };
    });
    if (!claim.claimed && claim.existing) {
      return NextResponse.json({ success: true, shipment: serializeBigInt(claim.existing) });
    }

    const adapter = new BiteshipAdapter(
      process.env.BITESHIP_BASE_URL || "https://api.biteship.com",
      apiKey,
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
        origin_area_id: warehouse.areaId || undefined,
        destination_contact_name: shippingAddr.contactName || order.guestName,
        destination_contact_phone: shippingAddr.contactPhone || order.guestPhone,
        destination_contact_email: shippingAddr.contactEmail || order.guestEmail,
        destination_address: shippingAddr.address,
        destination_postal_code: Number(shippingAddr.postalCode),
        destination_area_id: shippingAddr.areaId || undefined,
        courier_company: quote.courierCompany,
        courier_type: quote.courierType,
        delivery_type: body.data.deliveryType,
        delivery_date: body.data.deliveryDate,
        delivery_time: body.data.deliveryTime,
        order_note: shippingAddr.note || undefined,
        items: shippingItems,
      });
    } catch (cause) {
      await prisma.shipment.updateMany({ where: { orderId: order.id, status: "booking_claimed" }, data: { status: "booking_failed" } });
      throw cause;
    }

    const shipment = await prisma.$transaction(async tx => {
      const currentOrder = await tx.order.findUnique({ where: { id: order.id }, select: { fulfillmentState: true } });
      if (currentOrder?.fulfillmentState === "cancelled") {
        try { await adapter.cancelOrder(providerResult.id, "others", "Pesanan dibatalkan bersamaan dengan booking"); }
        catch { /* ignore provider cancel error */ }
        throw new BookingConflictError("Booking dibatalkan karena pesanan sudah dibatalkan");
      }

      await tx.shipment.deleteMany({ where: { orderId: order.id, status: { in: ["booking_claimed", "booking_failed"] } } });

      const initialStatus = normalizeBiteshipStatus(providerResult.status || "allocated");
      const saved = await tx.shipment.create({
        data: {
          orderId: order.id,
          warehouseId: warehouse.id,
          providerOrderId: providerResult.id,
          referenceId: providerResult.reference_id || reference,
          trackingId: providerResult.courier?.tracking_id || providerResult.id,
          waybillId: providerResult.courier?.waybill_id || providerResult.courier?.tracking_id || null,
          courierCompany: providerResult.courier?.company || quote.courierCompany,
          courierType: providerResult.courier?.type || quote.courierType,
          collectionMethod: body.data.collectionMethod,
          quotedPrice: quote.price,
          actualPrice: BigInt(providerResult.price || quote.price),
          status: initialStatus,
          lastProviderSyncAt: new Date(),
          raw: providerResult as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.order.update({ where: { id: order.id }, data: { fulfillmentState: "shipment_booked" } });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "shipment.created",
          entityType: "shipment",
          entityId: saved.id,
          after: { providerOrderId: saved.providerOrderId, waybillId: saved.waybillId },
        },
      });
      return saved;
    });

    return NextResponse.json({ success: true, shipment: serializeBigInt(shipment) });
  } catch (cause) {
    if (cause instanceof BookingConflictError) return NextResponse.json({ error: cause.message }, { status: 409 });
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Booking Biteship gagal" }, { status: 502 });
  }
}
