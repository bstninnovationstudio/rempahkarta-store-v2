import Link from "next/link";
import { Download, Filter } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getAdminOrders } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";
import { AdminOrderDuplicateButton } from "@/components/admin-order-duplicate-button";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = (await searchParams) || {};
  const allOrders = await getAdminOrders();

  const processingCount = allOrders.filter(order => order.fulfillment === "awaiting_processing").length;
  const activeCount = allOrders.filter(order => order.fulfillment === "processing").length;
  const pickupCount = allOrders.filter(order => order.fulfillment === "handover_pending").length;
  const inTransitCount = allOrders.filter(order => order.fulfillment === "in_transit").length;
  const issueCount = allOrders.filter(order => order.issueOrder).length;

  let orders = allOrders;
  if (filter === "processing") {
    orders = allOrders.filter(order => order.fulfillment === "awaiting_processing");
  } else if (filter === "active") {
    orders = allOrders.filter(order => order.fulfillment === "processing");
  } else if (filter === "pickup") {
    orders = allOrders.filter(order => order.fulfillment === "handover_pending");
  } else if (filter === "intransit") {
    orders = allOrders.filter(order => order.fulfillment === "in_transit");
  } else if (filter === "issue") {
    orders = allOrders.filter(order => order.issueOrder);
  }

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Order management</p>
          <h1>Pesanan</h1>
          <p>Kelola pembayaran, pemrosesan, handover, dan exception.</p>
        </div>
        <button className="button button-light">
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="filter-row">
        <Link href="/admin/orders" className={`filter-chip ${!filter ? "active" : ""}`}>
          Semua <b>{allOrders.length}</b>
        </Link>
        <Link href="/admin/orders?filter=processing" className={`filter-chip ${filter === "processing" ? "active" : ""}`}>
          Perlu diproses <b>{processingCount}</b>
        </Link>
        <Link href="/admin/orders?filter=active" className={`filter-chip ${filter === "active" ? "active" : ""}`}>
          Sedang diproses <b>{activeCount}</b>
        </Link>
        <Link href="/admin/orders?filter=pickup" className={`filter-chip ${filter === "pickup" ? "active" : ""}`}>
          Menunggu pickup <b>{pickupCount}</b>
        </Link>
        <Link href="/admin/orders?filter=intransit" className={`filter-chip ${filter === "intransit" ? "active" : ""}`}>
          Dalam perjalanan <b>{inTransitCount}</b>
        </Link>
        <Link
          href="/admin/orders?filter=issue"
          className={`filter-chip filter-chip-danger ${filter === "issue" ? "active" : ""}`}
        >
          Pesanan bermasalah <b>{issueCount}</b>
        </Link>
      </div>

      <section className="table-card">
        <div className="table-toolbar">
          <input placeholder="Cari nomor pesanan atau pelanggan" />
          <select>
            <option>Semua pembayaran</option>
            <option>Lunas</option>
            <option>Refund pending</option>
          </select>
          <button className="button button-light button-compact">
            <Filter size={14} /> Filter
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pesanan</th>
                <th>Pelanggan</th>
                <th>Pembayaran</th>
                <th>Fulfillment</th>
                <th>Kurir</th>
                <th>Total</th>
                <th>SLA</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.number} className={order.issueOrder ? "admin-issue-row" : ""}>
                  <td>
                    <strong>{order.number}</strong>
                    {order.issueOrder && (
                      <span className="issue-badge">Issue</span>
                    )}
                    <span className="sub">{order.createdAt}</span>
                  </td>
                  <td>{order.customer}</td>
                  <td>
                    <StatusPill status={order.payment} />
                  </td>
                  <td>
                    <StatusPill status={order.fulfillment} />
                  </td>
                  <td>{order.courier}</td>
                  <td>
                    <strong>{rupiah(order.total)}</strong>
                  </td>
                  <td>{order.sla}</td>
                  <td>
                    <div className="table-actions">
                      <Link href={`/admin/orders/${order.number}`} className="table-link">Buka →</Link>
                      <AdminOrderDuplicateButton number={order.number} />
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={8} className="admin-table-empty">Tidak ada pesanan untuk filter ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
