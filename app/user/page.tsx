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

export default async function UserDashboardPage() {
  const customer = await customerFromRequest();
  if (!customer) return null;

  // Retrieve user orders (including guest orders matching their email)
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { userId: customer.id },
        { userId: null, guestEmail: customer.email }
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  const totalOrders = orders.length;

  const totalSpent = orders
    .filter(order => order.paymentState === "paid" || order.fulfillmentState === "completed")
    .reduce((sum, order) => sum + Number(order.grandTotal), 0);

  const pendingPayments = orders.filter(order => order.paymentState === "pending").length;

  const recentOrders = orders.slice(0, 3);

  return (
    <div>
      <div className="user-content-header">
        <h1>Ringkasan Akun</h1>
        <p>Selamat datang kembali, {customer.name}. Pantau pesanan dan atur profil belanja Anda.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Transaksi</span>
          <strong>{totalOrders} Pesanan</strong>
        </div>
        <div className="stat-card">
          <span>Total Belanja</span>
          <strong>{rupiah(totalSpent)}</strong>
        </div>
        <div className="stat-card">
          <span>Menunggu Pembayaran</span>
          <strong>{pendingPayments} Transaksi</strong>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Pesanan Terbaru</h2>
        {recentOrders.length > 0 ? (
          <div className="recent-orders-list">
            {recentOrders.map(order => (
              <Link key={order.id} href={`/orders/${order.publicNumber}`} className="order-row">
                <div className="order-row-info">
                  <h4>{order.publicNumber}</h4>
                  <span>{new Date(order.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}</span>
                </div>
                <div className="order-row-meta">
                  <strong>{rupiah(Number(order.grandTotal))}</strong>
                  <StatusPill status={uiStatus(order.fulfillmentState)} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="account-empty-state compact">Anda belum pernah melakukan pemesanan.</p>
        )}
      </div>
    </div>
  );
}
