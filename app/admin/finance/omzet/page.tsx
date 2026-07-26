import Link from "next/link";
import { Banknote, Clock3, ListChecks, WalletCards } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { RevenueFinanceManager } from "@/components/revenue-finance-manager";
import { prisma } from "@/lib/db";
import { getRevenueStats } from "@/lib/finance";
import { rupiah } from "@/lib/format";

const pageSize = 20;
const labels: Record<string, string> = { ORDER_HOLD: "Dana tertahan", ORDER_AVAILABLE: "Dana tersedia", ORDER_RELEASE: "Dana dilepas", ORDER_REFUND: "Refund", WITHDRAWAL: "Penarikan", ADJUSTMENT_ADD: "Penyesuaian masuk", ADJUSTMENT_SUBTRACT: "Penyesuaian keluar" };

export default async function RevenueFinancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Math.max(1, Number((await searchParams).page) || 1);
  const total = await prisma.revenueLedger.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const [stats, entries] = await Promise.all([
    getRevenueStats(),
    prisma.revenueLedger.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize, include: { order: { select: { publicNumber: true } } } }),
  ]);
  const pagination = { page, pageSize, total, totalPages, from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total) };

  return <div className="admin-content finance-page">
    <div className="admin-page-head"><div><p className="eyebrow">Keuangan</p><h1>Kelola Dana Omzet</h1><p>Pantau omzet produk setelah diskon, ongkir, admin toko, dan kode unik melalui ledger yang dapat diaudit. Fee QRIS tidak masuk saldo omzet.</p></div></div>
    <section className="metrics-grid" aria-label="Ringkasan dana omzet">
      <article className="metric-card"><div className="metric-card-head"><span>Saldo bisa ditarik</span><WalletCards size={16}/></div><strong>{rupiah(stats.availableBalance)}</strong><span className="metric-trend">Settlement selesai setelah fee QRIS</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Saldo tertahan</span><Clock3 size={16}/></div><strong>{rupiah(stats.heldBalance)}</strong><span className="metric-trend tone-warning">Pesanan aktif, isu, pembatalan, atau retur</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Total transaksi</span><Banknote size={16}/></div><strong>{rupiah(stats.totalTransactions)}</strong><span className="metric-trend">Produk net + ongkir + admin toko + kode unik − refund</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Pesanan tercatat</span><ListChecks size={16}/></div><strong>{stats.orderTransactionCount}</strong><span className="metric-trend">{stats.ledgerEntryCount} perubahan ledger dapat diaudit</span></article>
    </section>
    <RevenueFinanceManager availableBalance={(stats.availableBalance > BigInt(0) ? stats.availableBalance : BigInt(0)).toString()}/>
    <section className="table-card finance-ledger-table" aria-labelledby="revenue-ledger-title"><div className="admin-panel-head"><div><h2 id="revenue-ledger-title">Riwayat dana omzet</h2><p>Omzet bersih = subtotal produk setelah diskon + ongkir + admin toko + kode unik − refund. Fee QRIS bukan omzet.</p></div></div><div className="admin-table-wrap" role="region" aria-labelledby="revenue-ledger-title" tabIndex={0}><table className="admin-table"><thead><tr><th>Waktu</th><th>Pesanan</th><th>Jenis</th><th>Rincian settlement</th><th>Tersedia</th><th>Tertahan</th><th>Catatan</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(entry.createdAt)}</td><td>{entry.order ? <Link className="table-link" href={`/admin/orders/${entry.order.publicNumber}`}>{entry.order.publicNumber}</Link> : "—"}</td><td><span className="finance-type">{labels[entry.type] || entry.type}</span></td><td>{entry.order ? <div className="finance-settlement-breakdown"><span>Subtotal produk <strong>{rupiah(entry.productSubtotal)}</strong></span>{entry.discountAmount > 0 && <span>Diskon <strong className="finance-negative">−{rupiah(entry.discountAmount)}</strong></span>}<span>Omzet produk <strong>{rupiah(entry.productSubtotal > entry.discountAmount ? entry.productSubtotal - entry.discountAmount : BigInt(0))}</strong></span><span>Ongkir <strong>{rupiah(entry.shippingFee)}</strong></span><span>Admin toko <strong>{rupiah(entry.serviceFee > entry.adminFee ? entry.serviceFee - entry.adminFee : BigInt(0))}</strong></span><span>Kode unik <strong>{rupiah(entry.uniqueCode)}</strong></span><span>Fee QRIS <strong className="finance-negative">Bukan omzet · {rupiah(entry.adminFee)}</strong></span><span>Total QRIS <strong>{rupiah(entry.grossAmount)}</strong></span><span>Posisi bersih <strong>{rupiah(entry.netAmount)}</strong></span></div> : "—"}</td><td><strong className={entry.availableDelta >= 0 ? "finance-positive" : "finance-negative"}>{entry.availableDelta > 0 ? "+" : ""}{rupiah(entry.availableDelta)}</strong></td><td><strong className={entry.heldDelta >= 0 ? "finance-positive" : "finance-negative"}>{entry.heldDelta > 0 ? "+" : ""}{rupiah(entry.heldDelta)}</strong></td><td className="admin-table-cell-wrap">{entry.notes || "—"}</td></tr>)}{!entries.length && <tr><td colSpan={7} className="table-empty-state">Belum ada transaksi omzet.</td></tr>}</tbody></table></div></section>
    <AdminPagination data={pagination} basePath="/admin/finance/omzet" itemLabel="transaksi"/>
  </div>;
}
