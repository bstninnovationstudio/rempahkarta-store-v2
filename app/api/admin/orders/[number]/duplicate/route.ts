import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security";
import { isDemo } from "@/lib/env";
import { invalidateCatalogCache } from "@/lib/catalog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  if (!isDemo()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = await adminFromRequest();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { number } = await params;

  // 1. Fetch source order details
  const sourceOrder = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      items: true,
      addresses: true,
      quotes: { where: { selectedAt: { not: null } }, take: 1 },
    },
  });

  if (!sourceOrder) {
    return NextResponse.json({ error: "Pesanan asal tidak ditemukan" }, { status: 404 });
  }

  // 2. Prepare new order data
  const token = randomToken();
  const hash = await sha256(token);
  const newPublicNumber = `ORD-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  try {
    const duplicatedOrder = await prisma.$transaction(async (tx) => {
      // 3. Stock Invariant Check and Reservation
      for (const item of sourceOrder.items) {
        if (!item.variantId) continue;
        
        const inventory = await tx.inventoryLevel.findFirst({
          where: { variantId: item.variantId },
        });
        
        if (!inventory) {
          throw new Error(`Inventory level tidak ditemukan untuk SKU ${item.skuSnapshot}`);
        }

        // Check if stock is sufficient using the invariant formula:
        // available = onHand - reserved - safetyStock
        const available = inventory.onHand - inventory.reserved - inventory.safetyStock;
        if (available < item.quantity) {
          throw new Error(`Stok produk ${item.skuSnapshot} tidak mencukupi (Tersedia: ${available}, Dibutuhkan: ${item.quantity}).`);
        }

        // Update inventory level atomically
        const updated = await tx.inventoryLevel.updateMany({
          where: {
            id: inventory.id,
            version: inventory.version,
            onHand: { gte: inventory.reserved + inventory.safetyStock + item.quantity },
          },
          data: {
            reserved: { increment: item.quantity },
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new Error(`Stok ${item.skuSnapshot} berubah karena transaksi lain. Silakan coba kembali.`);
        }
      }

      // 4. Create the new Order record
      const newOrder = await tx.order.create({
        data: {
          publicNumber: newPublicNumber,
          userId: sourceOrder.userId,
          guestName: sourceOrder.guestName,
          guestEmail: sourceOrder.guestEmail,
          guestPhone: sourceOrder.guestPhone,
          accessTokenHash: hash,
          policyVersion: sourceOrder.policyVersion,
          currency: sourceOrder.currency,
          subtotal: sourceOrder.subtotal,
          shippingFee: sourceOrder.shippingFee,
          grandTotal: sourceOrder.grandTotal,
          paymentState: "paid",
          fulfillmentState: "awaiting_processing",
          issueOrder: false,
          issueReason: null,
          addresses: {
            create: sourceOrder.addresses.map((addr) => ({
              type: addr.type,
              contactName: addr.contactName,
              contactPhone: addr.contactPhone,
              contactEmail: addr.contactEmail,
              address: addr.address,
              note: addr.note,
              postalCode: addr.postalCode,
              areaId: addr.areaId,
              latitude: addr.latitude,
              longitude: addr.longitude,
            })),
          },
          items: {
            create: sourceOrder.items.map((item) => ({
              variantId: item.variantId,
              skuSnapshot: item.skuSnapshot,
              nameSnapshot: item.nameSnapshot,
              optionsSnapshot: item.optionsSnapshot ?? {},
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              weight: item.weight,
              length: item.length,
              width: item.width,
              height: item.height,
            })),
          },
          quotes: sourceOrder.quotes.length > 0
            ? {
                create: sourceOrder.quotes.map((q) => ({
                  courierCompany: q.courierCompany,
                  courierType: q.courierType,
                  courierName: q.courierName,
                  price: q.price,
                  etaText: q.etaText,
                  collectionMethods: q.collectionMethods ?? ["pickup"],
                  request: q.request ?? {},
                  response: q.response ?? {},
                  selectedAt: new Date(),
                })),
              }
            : undefined,
          payments: {
            create: {
              provider: "mock",
              providerPaymentId: `mock_dup_${newPublicNumber}`,
              projectPaymentRef: newPublicNumber,
              amount: sourceOrder.grandTotal,
              payableAmount: sourceOrder.grandTotal,
              feeAmount: 0,
              status: "paid",
              paidAt: new Date(),
              raw: { duplicatedFrom: sourceOrder.publicNumber },
              paymentPageUrl: `/orders/${newPublicNumber}`,
            },
          },
        },
      });

      // 5. Create Audit Logs
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "order.duplicated",
          entityType: "order",
          entityId: newOrder.id,
          after: {
            originalOrderNumber: sourceOrder.publicNumber,
            newOrderNumber: newPublicNumber,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "system",
          actorId: "system",
          action: "payment.mock_paid",
          entityType: "order",
          entityId: newOrder.id,
          after: { autoPaid: true },
        },
      });

      return newOrder;
    });
    invalidateCatalogCache();

    return NextResponse.json({
      success: true,
      order_number: duplicatedOrder.publicNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal melakukan duplikasi order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
