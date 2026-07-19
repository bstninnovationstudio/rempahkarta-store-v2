import Link from "next/link";
import { Truck } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { StatusPill } from "@/components/status-pill";
import { getShipmentRowsPage } from "@/lib/admin-data";

export default async function Shipments({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const query = await searchParams;
  const { rows, stats, pagination } = await getShipmentRowsPage({ page: Number(query.page), pageSize: Number(query.pageSize) });

  return (
    <div className="admin-content admin-shipments-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Operasional Biteship</p>
          <h1>Pengiriman</h1>
          <p>Pantau booking, pickup atau drop-off, nomor resi, dan perjalanan paket.</p>
        </div>
      </div>

      <section className="metrics-grid" aria-label="Ringkasan pengiriman">
        <article className="metric-card">
          <div className="metric-card-head"><span>Total pengiriman</span><Truck size={15} aria-hidden="true" /></div>
          <strong className="admin-numeric">{stats.total}</strong>
          <span className="metric-trend">Booking tercatat</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Menunggu pickup</span></div>
          <strong className="admin-numeric">{stats.awaitingPickup}</strong>
          <span className="metric-trend">Perlu dipantau</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Dalam perjalanan</span></div>
          <strong className="admin-numeric">{stats.inTransit}</strong>
          <span className="metric-trend">Pelacakan aktif</span>
        </article>
        <article className="metric-card metric-card-neutral">
          <div className="metric-card-head"><span>Kendala pengiriman</span></div>
          <strong className="admin-numeric">{stats.issue}</strong>
          <span className="metric-trend">Status provider perlu perhatian</span>
        </article>
      </section>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Daftar pengiriman yang tercatat</caption>
            <thead>
              <tr>
                <th scope="col">Pesanan</th>
                <th scope="col">Kurir</th>
                <th scope="col">Nomor resi</th>
                <th scope="col">Metode</th>
                <th scope="col">Status</th>
                <th scope="col">Pembaruan terakhir</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.number}>
                  <td><strong className="admin-data-code">{row.number}</strong></td>
                  <td className="admin-table-cell-wrap">{row.courier}</td>
                  <td><span className="admin-data-code">{row.waybill}</span></td>
                  <td>{row.method}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td>{row.updatedAt}</td>
                  <td><Link href={`/admin/orders/${row.number}`} className="table-link">Buka pesanan<span aria-hidden="true"> →</span></Link></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="table-empty-state" colSpan={7}>Belum ada pengiriman yang tercatat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination data={pagination} basePath="/admin/shipments" query={{ pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="pengiriman" />
      </section>
    </div>
  );
}
