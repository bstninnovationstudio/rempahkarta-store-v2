import { AlertTriangle } from "lucide-react";
import { InventoryAdjustButton } from "@/components/inventory-adjust-button";
import { getInventoryRows } from "@/lib/admin-data";

export default async function InventoryPage() {
  const rows = await getInventoryRows();
  const onHand = rows.reduce((sum, row) => sum + row.onHand, 0);
  const reserved = rows.reduce((sum, row) => sum + row.reserved, 0);
  const available = rows.reduce((sum, row) => sum + Math.max(0, row.onHand - row.reserved - row.safety), 0);
  const low = rows.filter(row => row.onHand - row.reserved - row.safety <= row.lowStockThreshold).length;

  return (
    <div className="admin-content admin-inventory-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Buku stok</p>
          <h1>Inventori</h1>
          <p>Stok fisik, reservasi, stok pengaman, dan ketersediaan setiap SKU.</p>
        </div>
      </div>

      <section className="metrics-grid" aria-label="Ringkasan inventori">
        <article className="metric-card">
          <div className="metric-card-head"><span>Total stok fisik</span></div>
          <strong className="admin-numeric">{onHand}</strong>
          <span className="metric-trend">{rows.length} SKU</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Direservasi</span></div>
          <strong className="admin-numeric">{reserved}</strong>
          <span className="metric-trend">Unit dalam pesanan</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Siap dijual</span></div>
          <strong className="admin-numeric">{available}</strong>
          <span className="metric-trend">Setelah stok pengaman</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Stok menipis</span><AlertTriangle size={15} aria-hidden="true" /></div>
          <strong className="admin-numeric">{low}</strong>
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
                <th scope="col">Stok pengaman</th>
                <th scope="col">Tersedia</th>
                <th scope="col">Status</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowAvailable = Math.max(0, row.onHand - row.reserved - row.safety);
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
                    <td className="admin-numeric">{row.safety}</td>
                    <td><strong className="admin-numeric">{rowAvailable}</strong></td>
                    <td><span className={`status-pill ${statusClass}`}>{rowAvailable === 0 ? "Stok habis" : isLow ? "Stok menipis" : "Aman"}</span></td>
                    <td><InventoryAdjustButton id={row.id} reserved={row.reserved} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td className="table-empty-state" colSpan={7}>Belum ada data inventori.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
