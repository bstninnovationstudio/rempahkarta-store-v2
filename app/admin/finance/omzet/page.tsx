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
    <div className="admin-page-head"><div><p className="eyebrow">Keuangan</p><h1>Kelola Dana Omzet</h1><p>Pantau omzet bersih produk, dana tertahan, dan pencatatan penarikan tanpa menghitung ulang seluruh pesanan.</p></div></div>
    <section className="metrics-grid" aria-label="Ringkasan dana omzet">
      <article className="metric-card"><div className="metric-card-head"><span>Saldo bisa ditarik</span><WalletCards size={16}/></div><strong>{rupiah(stats.availableBalance)}</strong><span className="metric-trend">Dana bersih dari pesanan yang sudah selesai</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Saldo tertahan</span><Clock3 size={16}/></div><strong>{rupiah(stats.heldBalance)}</strong><span className="metric-trend tone-warning">Pesanan aktif, isu, pembatalan, atau retur</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Total transaksi</span><Banknote size={16}/></div><strong>{rupiah(stats.totalTransactions)}</strong><span className="metric-trend">Omzet bersih setelah refund, sebelum penarikan</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Pesanan tercatat</span><ListChecks size={16}/></div><strong>{stats.orderTransactionCount}</strong><span className="metric-trend">{stats.ledgerEntryCount} perubahan ledger dapat diaudit</span></article>
    </section>
    <RevenueFinanceManager availableBalance={(stats.availableBalance > BigInt(0) ? stats.availableBalance : BigInt(0)).toString()}/>
    <section className="table-card finance-ledger-table" aria-labelledby="revenue-ledger-title"><div className="admin-panel-head"><div><h2 id="revenue-ledger-title">Riwayat dana omzet</h2><p>Omzet bersih produk = subtotal produk − diskon. Ongkir dan biaya layanan tersimpan sebagai snapshot, bukan bagian saldo omzet.</p></div></div><div className="admin-table-wrap" role="region" aria-labelledby="revenue-ledger-title" tabIndex={0}><table className="admin-table"><thead><tr><th>Waktu</th><th>Pesanan</th><th>Jenis</th><th>Tersedia</th><th>Tertahan</th><th>Catatan</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(entry.createdAt)}</td><td>{entry.order ? <Link className="table-link" href={`/admin/orders/${entry.order.publicNumber}`}>{entry.order.publicNumber}</Link> : "—"}</td><td><span className="finance-type">{labels[entry.type] || entry.type}</span></td><td><strong className={entry.availableDelta >= 0 ? "finance-positive" : "finance-negative"}>{entry.availableDelta > 0 ? "+" : ""}{rupiah(Number(entry.availableDelta))}</strong></td><td><strong className={entry.heldDelta >= 0 ? "finance-positive" : "finance-negative"}>{entry.heldDelta > 0 ? "+" : ""}{rupiah(Number(entry.heldDelta))}</strong></td><td className="admin-table-cell-wrap">{entry.notes || "—"}</td></tr>)}{!entries.length && <tr><td colSpan={6} className="table-empty-state">Belum ada transaksi omzet.</td></tr>}</tbody></table></div></section>
    <AdminPagination data={pagination} basePath="/admin/finance/omzet" itemLabel="transaksi"/>
  </div>;
}
