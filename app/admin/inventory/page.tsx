import { AlertTriangle } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { InventoryAdjustButton } from "@/components/inventory-adjust-button";
import { getInventoryPage } from "@/lib/admin-data";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const query = await searchParams;
  const { rows, stats, pagination } = await getInventoryPage({ page: Number(query.page), pageSize: Number(query.pageSize) });

  return (
    <div className="admin-content admin-inventory-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Buku stok</p>
          <h1>Inventori</h1>
          <p>Stok fisik, reservasi, dan ketersediaan setiap SKU.</p>
        </div>
      </div>

      <section className="metrics-grid" aria-label="Ringkasan inventori">
        <article className="metric-card">
          <div className="metric-card-head"><span>Total stok fisik</span></div>
          <strong className="admin-numeric">{stats.onHand}</strong>
          <span className="metric-trend">{pagination.total} SKU</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Direservasi</span></div>
          <strong className="admin-numeric">{stats.reserved}</strong>
          <span className="metric-trend">Unit dalam pesanan</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Siap dijual</span></div>
          <strong className="admin-numeric">{stats.available}</strong>
          <span className="metric-trend">Setelah reservasi pesanan</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Stok menipis</span><AlertTriangle size={15} aria-hidden="true" /></div>
          <strong className="admin-numeric">{stats.low}</strong>
          <span className="metric-trend tone-warning">Pada atau di bawah batas SKU</span>
        </article>
      </section>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Stok dan ketersediaan per SKU</caption>
            <thead>
              <tr>
                <th scope="col">SKU / Produk</th>
                <th scope="col">Stok fisik</th>
                <th scope="col">Direservasi</th>
                <th scope="col">Tersedia</th>
                <th scope="col">Status</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowAvailable = Math.max(0, row.onHand - row.reserved);
                const isLow = rowAvailable <= row.lowStockThreshold;
                const statusClass = rowAvailable === 0 ? "status-cancelled" : isLow ? "status-pending" : "status-paid";

                return (
                  <tr key={row.id}>
                    <td>
                      <strong className="admin-data-code">{row.sku}</strong>
                      <span className="sub">{row.name} · {row.color}</span>
                    </td>
                    <td><span className="inventory-number admin-numeric">{row.onHand}</span></td>
                    <td className="admin-numeric">{row.reserved}</td>
                    <td><strong className="admin-numeric">{rowAvailable}</strong></td>
                    <td><span className={`status-pill ${statusClass}`}>{rowAvailable === 0 ? "Stok habis" : isLow ? "Stok menipis" : "Aman"}</span></td>
                    <td><InventoryAdjustButton id={row.id} sku={row.sku} name={`${row.name} · ${row.color}`} onHand={row.onHand} reserved={row.reserved} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td className="table-empty-state" colSpan={6}>Belum ada data inventori.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination data={pagination} basePath="/admin/inventory" query={{ pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="SKU" />
      </section>
    </div>
  );
}
