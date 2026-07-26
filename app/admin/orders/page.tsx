import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { AdminPagination } from "@/components/admin-pagination";
import { getAdminOrdersPage } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; pageSize?: string }>;
}) {
  const query = (await searchParams) || {};
  // Default ke filter "processing" jika tidak ada filter param
  const effectiveFilter = query.filter || "processing";
  const result = await getAdminOrdersPage({ filter: effectiveFilter, page: Number(query.page), pageSize: Number(query.pageSize) });
  const { rows: orders, counts, pagination, filter } = result;

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
        <Link href="/admin/orders?filter=all" aria-current={query.filter === "all" ? "page" : undefined} className={`filter-chip ${query.filter === "all" ? "active" : ""}`}>
          Semua <b>{counts.all}</b>
        </Link>
        <Link href="/admin/orders" aria-current={(!query.filter || query.filter === "processing") ? "page" : undefined} className={`filter-chip ${(!query.filter || query.filter === "processing") ? "active" : ""}`}>
          Perlu diproses <b>{counts.processing}</b>
        </Link>
        <Link href="/admin/orders?filter=pickup" aria-current={query.filter === "pickup" ? "page" : undefined} className={`filter-chip ${query.filter === "pickup" ? "active" : ""}`}>
          Menunggu pickup <b>{counts.pickup}</b>
        </Link>
        <Link href="/admin/orders?filter=intransit" aria-current={query.filter === "intransit" ? "page" : undefined} className={`filter-chip ${query.filter === "intransit" ? "active" : ""}`}>
          Dalam perjalanan <b>{counts.intransit}</b>
        </Link>
        <Link href="/admin/orders?filter=cancel" aria-current={(query.filter === "cancel" || query.filter === "cancellation") ? "page" : undefined} className={`filter-chip ${(query.filter === "cancel" || query.filter === "cancellation") ? "active" : ""}`}>
          Pengajuan pembatalan <b>{counts.cancel}</b>
        </Link>
        <Link
          href="/admin/orders?filter=issue"
          aria-current={query.filter === "issue" ? "page" : undefined}
          className={`filter-chip filter-chip-danger ${query.filter === "issue" ? "active" : ""}`}
        >
          Pesanan bermasalah <b>{counts.issue}</b>
        </Link>
      </nav>

      <section className="table-card admin-orders-table">
        <div className="admin-orders-desktop-table">
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
        </div>

        <div className="admin-orders-mobile-list" aria-label="Daftar pesanan">
          {orders.map(order => (
            <article key={order.number} className={`order-card ${order.issueOrder ? "admin-issue-card" : ""}`}>
              <Link
                href={`/admin/orders/${order.number}`}
                className="order-card-main"
                aria-label={`Lihat rincian pesanan ${order.number}`}
              >
                <span className="order-card-icon">
                  <PackageOpen size={19} aria-hidden="true" />
                </span>
                <div className="order-card-identity">
                  <span>Nomor pesanan</span>
                  <h2>{order.number}</h2>
                  <p>Dibuat {order.createdAt}</p>
                </div>
                <div className="order-card-statuses" aria-label="Status pesanan">
                  <StatusPill status={order.payment} />
                  <StatusPill status={order.fulfillment} />
                </div>
                <div className="order-card-total">
                  <span>Total terima bersih</span>
                  <strong>{rupiah(order.total)}</strong>
                </div>
              </Link>
            </article>
          ))}
          {!orders.length && (
            <div className="admin-table-empty-content mobile-empty">
              <strong>Tidak ada pesanan untuk filter ini</strong>
              <span>Pilih filter lain atau tampilkan kembali semua pesanan.</span>
              {filter && <Link href="/admin/orders" className="table-link">Tampilkan semua pesanan</Link>}
            </div>
          )}
        </div>

        <AdminPagination data={pagination} basePath="/admin/orders" query={{ filter, pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="pesanan" />
      </section>
    </div>
  );
}
