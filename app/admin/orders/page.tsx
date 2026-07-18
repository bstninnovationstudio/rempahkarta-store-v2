import Link from "next/link";
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
          <p className="eyebrow">Manajemen pesanan</p>
          <h1>Pesanan</h1>
          <p>Kelola pembayaran, pemrosesan, serah terima, dan pesanan bermasalah.</p>
        </div>
      </div>

      <nav className="filter-row" aria-label="Filter status pesanan">
        <Link href="/admin/orders" aria-current={!filter ? "page" : undefined} className={`filter-chip ${!filter ? "active" : ""}`}>
          Semua <b>{allOrders.length}</b>
        </Link>
        <Link href="/admin/orders?filter=processing" aria-current={filter === "processing" ? "page" : undefined} className={`filter-chip ${filter === "processing" ? "active" : ""}`}>
          Perlu diproses <b>{processingCount}</b>
        </Link>
        <Link href="/admin/orders?filter=active" aria-current={filter === "active" ? "page" : undefined} className={`filter-chip ${filter === "active" ? "active" : ""}`}>
          Sedang diproses <b>{activeCount}</b>
        </Link>
        <Link href="/admin/orders?filter=pickup" aria-current={filter === "pickup" ? "page" : undefined} className={`filter-chip ${filter === "pickup" ? "active" : ""}`}>
          Menunggu pickup <b>{pickupCount}</b>
        </Link>
        <Link href="/admin/orders?filter=intransit" aria-current={filter === "intransit" ? "page" : undefined} className={`filter-chip ${filter === "intransit" ? "active" : ""}`}>
          Dalam perjalanan <b>{inTransitCount}</b>
        </Link>
        <Link
          href="/admin/orders?filter=issue"
          aria-current={filter === "issue" ? "page" : undefined}
          className={`filter-chip filter-chip-danger ${filter === "issue" ? "active" : ""}`}
        >
          Pesanan bermasalah <b>{issueCount}</b>
        </Link>
      </nav>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Daftar pesanan sesuai filter yang dipilih</caption>
            <thead>
              <tr>
                <th scope="col">Pesanan</th>
                <th scope="col">Pelanggan</th>
                <th scope="col">Pembayaran</th>
                <th scope="col">Pemrosesan</th>
                <th scope="col">Kurir</th>
                <th scope="col">Total</th>
                <th scope="col">SLA</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.number} className={order.issueOrder ? "admin-issue-row" : ""}>
                  <td>
                    <strong className="admin-data-code">{order.number}</strong>
                    {order.issueOrder && (
                      <span className="issue-badge">Masalah</span>
                    )}
                    <span className="sub">{order.createdAt}</span>
                  </td>
                  <td className="admin-table-cell-wrap">{order.customer}</td>
                  <td>
                    <StatusPill status={order.payment} />
                  </td>
                  <td>
                    <StatusPill status={order.fulfillment} />
                  </td>
                  <td className="admin-table-cell-wrap">{order.courier}</td>
                  <td>
                    <strong className="admin-numeric">{rupiah(order.total)}</strong>
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
              {!orders.length && (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    <div className="admin-table-empty-content">
                      <strong>Tidak ada pesanan untuk filter ini</strong>
                      <span>Pilih filter lain atau tampilkan kembali semua pesanan.</span>
                      {filter && <Link href="/admin/orders" className="table-link">Tampilkan semua pesanan</Link>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
