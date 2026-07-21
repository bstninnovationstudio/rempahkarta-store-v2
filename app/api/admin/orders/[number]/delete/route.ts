import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDevToolsEnabled } from "@/lib/env";
import { invalidateCatalogCache } from "@/lib/catalog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  if (!isDevToolsEnabled()) {
    return NextResponse.json({ error: "Fitur ini hanya tersedia pada mode development." }, { status: 403 });
  }

  const admin = await adminFromRequest();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { number } = await params;

  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    select: { id: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const payments = await prisma.payment.findMany({ where: { orderId: order.id }, select: { id: true } });
  const paymentIds = payments.map((p) => p.id);

  const shipments = await prisma.shipment.findMany({ where: { orderId: order.id }, select: { id: true } });
  const shipmentIds = shipments.map((s) => s.id);

  const returnRequests = await prisma.returnRequest.findMany({ where: { orderId: order.id }, select: { id: true } });
  const returnRequestIds = returnRequests.map((r) => r.id);

  await prisma.$transaction([
    prisma.cancellationRequest.deleteMany({ where: { orderId: order.id } }),
    prisma.returnItem.deleteMany({ where: { returnRequestId: { in: returnRequestIds } } }),
    prisma.returnRequest.deleteMany({ where: { orderId: order.id } }),
    prisma.refund.deleteMany({ where: { orderId: order.id } }),
    prisma.shipmentTrackingEvent.deleteMany({ where: { shipmentId: { in: shipmentIds } } }),
    prisma.shipment.deleteMany({ where: { orderId: order.id } }),
    prisma.paymentEvent.deleteMany({ where: { paymentId: { in: paymentIds } } }),
    prisma.payment.deleteMany({ where: { orderId: order.id } }),
    prisma.orderAddress.deleteMany({ where: { orderId: order.id } }),
    prisma.shippingQuote.deleteMany({ where: { orderId: order.id } }),
    prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
    prisma.inventoryMovement.deleteMany({ where: { referenceId: order.id } }),
    prisma.order.delete({ where: { id: order.id } }),
  ]);

  await invalidateCatalogCache();

  return NextResponse.json({ success: true, message: `Pesanan ${number} berhasil dihapus.` });
}
