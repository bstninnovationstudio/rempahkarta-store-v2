import Link from "next/link";
import { ArrowRight, Clock3, PackageCheck, Settings2, ShoppingBag, WalletCards } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { rupiah } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";

export default async function UserDashboardPage() {
  const customer = await customerFromRequest();
  if (!customer) return null;

  const accountOrderWhere: Prisma.OrderWhereInput = {
    OR: [
      { userId: customer.id },
      { userId: null, guestEmail: customer.email },
    ],
  };

  const [totalOrders, spending, pendingPayments, recentOrders] = await Promise.all([
    prisma.order.count({ where: accountOrderWhere }),
    prisma.order.aggregate({
      where: {
        AND: [
          accountOrderWhere,
          { OR: [{ paymentState: "paid" }, { fulfillmentState: "completed" }] },
        ],
      },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({
      where: { AND: [accountOrderWhere, { paymentState: "pending" }] },
    }),
    prisma.order.findMany({
      where: accountOrderWhere,
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        publicNumber: true,
        createdAt: true,
        grandTotal: true,
        fulfillmentState: true,
      },
    }),
  ]);

  const totalSpent = Number(spending._sum.grandTotal || 0);

  return (
    <div className="user-dashboard-page">
      <header className="user-page-hero dashboard-hero">
        <div>
          <span className="user-page-eyebrow">Ringkasan akun</span>
          <h1>Halo, {customer.name.split(" ")[0]}</h1>
          <p>Pantau aktivitas belanja, pembayaran, dan pesanan terbaru Anda dari satu tempat.</p>
        </div>
        <Link href="/#product" className="button button-dark">
          Belanja produk <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <section className="user-stats-grid" aria-label="Statistik akun">
        <article className="user-stat-card">
          <span className="user-stat-icon"><ShoppingBag size={19} aria-hidden="true" /></span>
          <div>
            <span>Total pesanan</span>
            <strong>{totalOrders}</strong>
            <small>Seluruh transaksi akun</small>
          </div>
        </article>
        <article className="user-stat-card">
          <span className="user-stat-icon"><WalletCards size={19} aria-hidden="true" /></span>
          <div>
            <span>Total belanja</span>
            <strong>{rupiah(totalSpent)}</strong>
            <small>Transaksi dibayar atau selesai</small>
          </div>
        </article>
        <article className="user-stat-card">
          <span className="user-stat-icon"><Clock3 size={19} aria-hidden="true" /></span>
          <div>
            <span>Menunggu pembayaran</span>
            <strong>{pendingPayments}</strong>
            <small>Perlu tindakan Anda</small>
          </div>
        </article>
      </section>

      <div className="user-dashboard-grid">
        <section className="user-dashboard-card user-recent-orders" aria-labelledby="recent-orders-title">
          <div className="user-dashboard-card-head">
            <div>
              <span>Aktivitas terbaru</span>
              <h2 id="recent-orders-title">Pesanan terbaru</h2>
            </div>
            <Link href="/user/orders">Lihat semua <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="recent-orders-list">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.publicNumber}`} className="order-row">
                  <span className="order-row-icon"><PackageCheck size={18} aria-hidden="true" /></span>
                  <div className="order-row-info">
                    <h3>{order.publicNumber}</h3>
                    <span>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(order.createdAt)}</span>
                  </div>
                  <div className="order-row-meta">
                    <strong>{rupiah(Number(order.grandTotal))}</strong>
                    <StatusPill status={order.fulfillmentState} />
                  </div>
                  <ArrowRight className="order-row-arrow" size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="account-empty-state compact">
              <PackageCheck size={25} aria-hidden="true" />
              <strong>Belum ada pesanan</strong>
              <p>Produk yang Anda pesan akan muncul di bagian ini.</p>
              <Link href="/#product" className="button button-light">Mulai belanja</Link>
            </div>
          )}
        </section>

        <aside className="user-dashboard-card user-quick-actions" aria-labelledby="quick-actions-title">
          <div className="user-dashboard-card-head">
            <div>
              <span>Akses cepat</span>
              <h2 id="quick-actions-title">Kelola akun</h2>
            </div>
          </div>
          <nav aria-label="Akses cepat pengaturan akun">
            <Link href="/user/orders">
              <span><PackageCheck size={17} aria-hidden="true" /></span>
              <div><strong>Riwayat pesanan</strong><small>Lacak status transaksi</small></div>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/user/settings#addresses">
              <span><Settings2 size={17} aria-hidden="true" /></span>
              <div><strong>Alamat pengiriman</strong><small>Tambah atau ubah alamat</small></div>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/user/settings#payment">
              <span><WalletCards size={17} aria-hidden="true" /></span>
              <div><strong>Rekening refund</strong><small>Kelola tujuan pengembalian</small></div>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
