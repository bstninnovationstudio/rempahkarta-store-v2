import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { AdminPagination } from "@/components/admin-pagination";
import { getAdminOrdersPage } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";
import { AdminOrderDuplicateButton } from "@/components/admin-order-duplicate-button";
import { isDemo } from "@/lib/env";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; pageSize?: string }>;
}) {
  const query = (await searchParams) || {};
  const result = await getAdminOrdersPage({ filter: query.filter, page: Number(query.page), pageSize: Number(query.pageSize) });
  const { rows: orders, counts, pagination, filter } = result;
  const developerToolsEnabled = isDemo();

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
          Semua <b>{counts.all}</b>
        </Link>
        <Link href="/admin/orders?filter=processing" aria-current={filter === "processing" ? "page" : undefined} className={`filter-chip ${filter === "processing" ? "active" : ""}`}>
          Perlu diproses <b>{counts.processing}</b>
        </Link>
        <Link href="/admin/orders?filter=active" aria-current={filter === "active" ? "page" : undefined} className={`filter-chip ${filter === "active" ? "active" : ""}`}>
          Sedang diproses <b>{counts.active}</b>
        </Link>
        <Link href="/admin/orders?filter=pickup" aria-current={filter === "pickup" ? "page" : undefined} className={`filter-chip ${filter === "pickup" ? "active" : ""}`}>
          Menunggu pickup <b>{counts.pickup}</b>
        </Link>
        <Link href="/admin/orders?filter=intransit" aria-current={filter === "intransit" ? "page" : undefined} className={`filter-chip ${filter === "intransit" ? "active" : ""}`}>
          Dalam perjalanan <b>{counts.intransit}</b>
        </Link>
        <Link
          href="/admin/orders?filter=issue"
          aria-current={filter === "issue" ? "page" : undefined}
          className={`filter-chip filter-chip-danger ${filter === "issue" ? "active" : ""}`}
        >
          Pesanan bermasalah <b>{counts.issue}</b>
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
                      {developerToolsEnabled && <AdminOrderDuplicateButton number={order.number} />}
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
        <AdminPagination data={pagination} basePath="/admin/orders" query={{ filter, pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="pesanan" />
      </section>
    </div>
  );
}
