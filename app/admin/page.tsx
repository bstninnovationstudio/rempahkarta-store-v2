import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Banknote, Box, Clock3, ShoppingBag } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getAdminDashboardData } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";

export default async function AdminDashboard() {
  const { latestOrders, stats } = await getAdminDashboardData();

  return (
    <div className="admin-content admin-dashboard-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Operasional toko</p>
          <h1>Ringkasan operasional</h1>
          <p>Pesanan terbaru dan pekerjaan yang perlu ditindaklanjuti.</p>
        </div>
        <Link href="/admin/products/new" className="button button-dark">
          Tambah produk
        </Link>
      </div>

      <section className="metrics-grid" aria-label="Ringkasan operasional">
        <article className="metric-card">
          <div className="metric-card-head"><span>Pesanan terbaru</span><ShoppingBag size={16} aria-hidden="true" /></div>
          <strong className="admin-numeric">{stats.totalOrders}</strong>
          <span className="metric-trend">Seluruh pesanan tercatat</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Penjualan terdata</span><Banknote size={16} aria-hidden="true" /></div>
          <strong className="admin-numeric admin-metric-money">{rupiah(stats.paidSales)}</strong>
          <span className="metric-trend">Akumulasi pesanan lunas</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Perlu diproses</span><Clock3 size={16} aria-hidden="true" /></div>
          <strong className="admin-numeric">{stats.needProcess}</strong>
          <span className="metric-trend tone-warning">Perlu menjaga SLA pemrosesan</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head"><span>Menunggu pickup</span><Box size={16} aria-hidden="true" /></div>
          <strong className="admin-numeric">{stats.pickup}</strong>
          <span className="metric-trend">Resi sudah dibuat</span>
        </article>
      </section>

      <div className="admin-grid">
        <section className="admin-panel" aria-labelledby="latest-orders-title">
          <div className="admin-panel-head">
            <h2 id="latest-orders-title">Pesanan terbaru</h2>
            <Link href="/admin/orders">Lihat semua <ArrowUpRight size={12} aria-hidden="true" /></Link>
          </div>
          <div className="order-list">
            {latestOrders.map(order => (
              <Link href={`/admin/orders/${order.number}`} className="order-list-item" key={order.number}>
                <div className="order-thumb">
                  <Image unoptimized src={order.image} alt="" fill />
                </div>
                <div className="admin-list-copy">
                  <strong className="admin-data-code">{order.number}</strong>
                  <p>{order.customer} · {order.item}</p>
                </div>
                <div className="admin-list-value">
                  <strong className="admin-numeric">{rupiah(order.total)}</strong>
                  <p>{order.createdAt}</p>
                </div>
                <StatusPill status={order.fulfillment} />
              </Link>
            ))}
            {latestOrders.length === 0 && (
              <div className="empty-state admin-list-empty">
                <ShoppingBag size={24} aria-hidden="true" />
                <strong>Belum ada pesanan</strong>
                <p>Pesanan terbaru akan tampil di area ini.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="admin-panel" aria-labelledby="action-queue-title">
          <div className="admin-panel-head"><h2 id="action-queue-title">Antrean tindakan</h2></div>
          <div className="quick-queue">
            <Link href="/admin/orders?filter=processing" className="queue-item">
              <div><strong>Perlu diproses</strong><span>Pesanan lunas baru</span></div>
              <span className="queue-count admin-numeric">{stats.needProcess}</span>
            </Link>
            <Link href="/admin/orders?filter=pickup" className="queue-item">
              <div><strong>Menunggu pickup</strong><span>Resi sudah dibuat</span></div>
              <span className="queue-count admin-numeric">{stats.pickup}</span>
            </Link>
            <Link href="/admin/returns" className="queue-item">
              <div><strong>Retur dan refund</strong><span>Tinjau antrean pengajuan</span></div>
              <span className="queue-action">Buka <ArrowUpRight size={12} aria-hidden="true" /></span>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
