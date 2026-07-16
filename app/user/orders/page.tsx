import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { rupiah } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import type { OrderStatus } from "@/lib/types";

function uiStatus(value: string): OrderStatus {
  if (["packed", "shipment_booked"].includes(value)) return "processing";
  if (["handed_over", "return_in_transit"].includes(value)) return "in_transit";
  if (value === "returned") return "completed";
  return (["awaiting_payment", "awaiting_processing", "processing", "handover_pending", "completed", "cancelled", "finished"].includes(value) ? value : "awaiting_processing") as OrderStatus;
}

function uiPaymentStatus(value: string): "paid" | "pending" | "refund_pending" {
  return value === "paid" ? "paid" : value === "refund_pending" ? "refund_pending" : "pending";
}

export default async function UserOrdersHistoryPage() {
  const customer = await customerFromRequest();
  if (!customer) return null;

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { userId: customer.id },
        { userId: null, guestEmail: customer.email }
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="user-content-header">
        <h1>Riwayat Pesanan</h1>
        <p>Lihat status pembayaran, pengiriman, dan rincian transaksi Anda.</p>
      </div>

      {orders.length > 0 ? (
        <div className="orders-history-list">
          {orders.map(order => {
            const dateStr = new Date(order.createdAt).toLocaleDateString("id-ID", {
              dateStyle: "medium",
            });
            return (
              <Link key={order.id} href={`/orders/${order.publicNumber}`} className="order-card">
                <div className="order-card-head">
                  <div>
                    <h3>{order.publicNumber}</h3>
                    <span>Dipesan tanggal {dateStr}</span>
                  </div>
                  <div className="order-card-statuses">
                    <StatusPill status={uiPaymentStatus(order.paymentState)} />
                    <StatusPill status={uiStatus(order.fulfillmentState)} />
                  </div>
                </div>
                <div className="order-card-body">
                  <div className="order-card-body-details">
                    <span>Total Pembayaran</span>
                    <strong>{rupiah(Number(order.grandTotal))}</strong>
                  </div>
                  <span className="order-card-link">
                    Lihat rincian →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="account-empty-state">
          Anda belum pernah melakukan pemesanan.
        </p>
      )}
    </div>
  );
}
