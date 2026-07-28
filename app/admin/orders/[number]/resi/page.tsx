import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShippingLabel, { type ShippingLabelProps } from "@/components/shipping-label";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Resi ${number}`,
  };
}

export default async function AdminOrderResiPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;

  let labelData: ShippingLabelProps["data"] | null = null;

  const { prisma } = await import("@/lib/db");
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      items: true,
      addresses: true,
      shipments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order || !order.shipments[0]) {
    notFound();
  }

  const shipment = order.shipments[0];
  const providerOrderId = shipment.providerOrderId?.trim() || "";
  const waybillId = shipment.waybillId?.trim() || shipment.trackingId?.trim() || "";
  const isSyntheticShipment = [providerOrderId, waybillId].some((value) =>
    /^(mock_|claim_)/i.test(value),
  );

  // A printable label must never contain a local simulation or a booking claim.
  // Wait for the real Biteship webhook/response to persist a tracking identifier.
  if (!providerOrderId || !waybillId || isSyntheticShipment) {
    notFound();
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: shipment.warehouseId },
  });
  const recipientAddr = order.addresses.find((a) => a.type === "shipping");

  if (!warehouse || !recipientAddr) {
    notFound();
  }

  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeightGram = order.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  const totalWeightKg = Math.max(0.1, totalWeightGram / 1000);

  const itemDescription = order.items
    .map((i) => {
      const opts = Object.values((i.optionsSnapshot as Record<string, string>) || {}).filter(Boolean).join(" / ");
      return `${i.nameSnapshot}${opts ? ` (${opts})` : ""} x${i.quantity}`;
    })
    .join(", ");

  const rawObj = (shipment.raw as Record<string, unknown>) || {};
  const destObj = rawObj?.destination as Record<string, unknown> | undefined;
  const courierObj = rawObj?.courier as Record<string, unknown> | undefined;
  const routingCode =
    destObj?.destination_code ||
    courierObj?.routing_code ||
    rawObj?.routing_code ||
    recipientAddr.postalCode;

  labelData = {
    waybillId,
    courierCompany: shipment.courierCompany,
    courierService: shipment.courierType.toUpperCase(),
    routingCode: String(routingCode),
    codAmount: 0,
    isCod: false,
    totalQuantity,
    totalWeightKg,
    sender: {
      name: warehouse.contactName || warehouse.name || "REMPAHKARTA",
      phone: warehouse.contactPhone || "-",
      address: warehouse.address,
      postalCode: warehouse.postalCode,
    },
    recipient: {
      name: recipientAddr.contactName || order.guestName,
      phone: recipientAddr.contactPhone || order.guestPhone,
      address: recipientAddr.address,
      postalCode: recipientAddr.postalCode,
    },
    itemDescription,
  };

  return <ShippingLabel data={labelData} />;
}
