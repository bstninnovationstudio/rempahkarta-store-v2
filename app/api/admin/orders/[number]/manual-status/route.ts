import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security";
import {
  releaseOrderReservation,
  restockCommittedOrder,
} from "@/lib/inventory";
import { normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { fulfillmentFromBiteshipStatus } from "@/lib/shipping-state";
import type { FulfillmentState } from "@prisma/client";
import { isDevToolsEnabled } from "@/lib/env";
import { invalidateCatalogCache } from "@/lib/catalog";
import { syncOrderRevenue } from "@/lib/finance";

const schema = z.object({
  type: z.enum(["fulfillment", "biteship", "issue"]),
  status: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  if (!isDevToolsEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = await adminFromRequest();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  const { number } = await params;
  const { type, status } = body.data;

  // 1. Fetch order details
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      shipments: { orderBy: { createdAt: "desc" }, take: 1 },
      quotes: { where: { selectedAt: { not: null } }, take: 1 },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (type === "fulfillment") {
        const targetState = status as FulfillmentState;
        
        // Handle inventory release/restock if manually set to cancelled
        if (targetState === "cancelled" && order.fulfillmentState !== "cancelled") {
          if (["awaiting_processing", "processing"].includes(order.fulfillmentState)) {
            await releaseOrderReservation(tx, order.id, "manual_status_change_cancelled");
          } else if (["packed", "shipment_booked", "handover_pending"].includes(order.fulfillmentState)) {
            await restockCommittedOrder(tx, order.id, "manual_status_change_cancelled");
          }
        }

        const updateData: Record<string, unknown> = {
          fulfillmentState: targetState,
        };

        if (targetState === "cancelled" && order.paymentState === "paid") {
          updateData.paymentState = "refund_pending";
        }

        // Update the order fulfillment state
        await tx.order.update({
          where: { id: order.id },
          data: updateData,
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: String(admin.email),
            action: "order.manual_status",
            entityType: "order",
            entityId: order.id,
            before: { fulfillmentState: order.fulfillmentState, paymentState: order.paymentState },
            after: { fulfillmentState: targetState, ...updateData },
          },
        });
      } 
      
      else if (type === "biteship") {
        const normalized = normalizeBiteshipStatus(status);
        let activeShipment = order.shipments[0];

        // Create a mock Shipment record if it doesn't exist yet
        if (!activeShipment) {
          const warehouse =
            (await tx.warehouse.findFirst({ where: { isDefault: true } })) ||
            (await tx.warehouse.findFirst());
          
          if (!warehouse) {
            throw new Error("Tidak ada gudang (Warehouse) untuk melakukan simulasi Biteship.");
          }

          const quote = order.quotes[0];
          const courierCompany = quote?.courierCompany || "mock";
          const courierType = quote?.courierType || "mock";
          const collectionMethod = Array.isArray(quote?.collectionMethods)
            ? String(quote.collectionMethods[0])
            : "pickup";
          const shippingPrice = quote?.price || BigInt(0);

          activeShipment = await tx.shipment.create({
            data: {
              orderId: order.id,
              warehouseId: warehouse.id,
              providerOrderId: `mock_biteship_${order.id}`,
              referenceId: `SHP-${order.publicNumber}`,
              trackingId: `mock_track_${order.id}`,
              waybillId: `mock_resi_${order.id}`,
              courierCompany,
              courierType,
              collectionMethod,
              quotedPrice: shippingPrice,
              actualPrice: shippingPrice,
              priceAdjustment: BigInt(0),
              status: normalized,
            },
          });
        } else {
          // Update existing shipment status
          activeShipment = await tx.shipment.update({
            where: { id: activeShipment.id },
            data: { status: normalized },
          });
        }

        // Add Shipment Tracking Event
        const payload = { mock: true, status: status, event: "order.status" };
        const payloadHash = await sha256(JSON.stringify(payload));
        
        await tx.shipmentTrackingEvent.create({
          data: {
            shipmentId: activeShipment.id,
            providerStatus: normalized,
            note: `Simulasi status Biteship: ${status}. Diubah secara manual oleh Admin.`,
            occurredAt: new Date(),
            payloadHash,
            payload,
          },
        });

        // Run the Biteship transition handler logic
        const fulfillment = fulfillmentFromBiteshipStatus(normalized);
        const orderUpdate: Record<string, unknown> = {};

        if (fulfillment && fulfillment !== order.fulfillmentState) {
          // Perform inventory operations if transition to cancelled
          if (fulfillment === "cancelled" && !["picked", "in_transit", "dropping_off", "delivered", "return_in_transit", "returned"].includes(activeShipment.status)) {
            if (["packed", "shipment_booked", "handover_pending"].includes(order.fulfillmentState)) {
              await restockCommittedOrder(tx, order.id, `biteship_mock_${normalized}`);
            } else if (["awaiting_payment", "awaiting_processing", "processing"].includes(order.fulfillmentState)) {
              await releaseOrderReservation(tx, order.id, `biteship_mock_${normalized}`);
            }
          }
          
          orderUpdate.fulfillmentState = fulfillment;
          if (fulfillment === "cancelled" && order.paymentState === "paid") {
            orderUpdate.paymentState = "refund_pending";
          }
        }

        // Set issue flag if status is in issue list
        const issueStatuses = [
          "cancelled",
          "courier_not_found",
          "rejected",
          "disposed",
          "return_in_transit",
          "returned",
        ];
        const isIssue = issueStatuses.includes(status) || issueStatuses.includes(normalized);
        const hasPaid = ["paid", "refund_pending"].includes(order.paymentState) || orderUpdate.paymentState === "refund_pending";

        if (isIssue && hasPaid) {
          orderUpdate.issueOrder = true;
          orderUpdate.issueReason = `Biteship: ${status}`;
        }

        if (Object.keys(orderUpdate).length > 0) {
          await tx.order.update({
            where: { id: order.id },
            data: orderUpdate,
          });
        }

        // Audit Log
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: String(admin.email),
            action: `biteship.mock_${status}`,
            entityType: "shipment",
            entityId: activeShipment.id,
            before: { status: order.shipments[0]?.status || "none", fulfillmentState: order.fulfillmentState },
            after: { status: normalized, ...orderUpdate },
          },
        });
      } 
      
      else if (type === "issue") {
        const isIssue = status === "true";
        await tx.order.update({
          where: { id: order.id },
          data: {
            issueOrder: isIssue,
            issueReason: isIssue ? "Ditandai manual oleh Admin" : null,
          },
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: String(admin.email),
            action: isIssue ? "order.issue_flagged" : "order.issue_cleared",
            entityType: "order",
            entityId: order.id,
            after: { issueOrder: isIssue },
          },
        });
      }
      await syncOrderRevenue(tx, order.id, String(admin.email));
    });

    invalidateCatalogCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengupdate status secara manual";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
