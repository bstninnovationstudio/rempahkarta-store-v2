import { CircleDollarSign, ListChecks, Route, WalletCards } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { BiteshipFinanceManager } from "@/components/biteship-finance-manager";
import { prisma } from "@/lib/db";
import { getBiteshipStats } from "@/lib/finance";
import { rupiah } from "@/lib/format";

const pageSize = 20;

export default async function BiteshipFinancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Math.max(1, Number((await searchParams).page) || 1);
  const total = await prisma.biteshipLedger.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const [stats, entries] = await Promise.all([
    getBiteshipStats(),
    prisma.biteshipLedger.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const account = stats.account;
  const pagination = { page, pageSize, total, totalPages, from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total) };

  return <div className="admin-content finance-page">
    <div className="admin-page-head"><div><p className="eyebrow">Keuangan</p><h1>Kelola Dana Biteship</h1><p>Saldo bayangan yang dikelola manual untuk menjaga permintaan area, ongkir, pembuatan shipment, dan sinkronisasi resi tetap terkendali.</p></div></div>
    <section className="metrics-grid" aria-label="Ringkasan dana Biteship">
      <article className="metric-card"><div className="metric-card-head"><span>Saldo bayangan</span><WalletCards size={16}/></div><strong>{rupiah(Number(account.balance))}</strong><span className="metric-trend">Dikelola manual, tidak membaca saldo server Biteship</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Total tambah dana</span><CircleDollarSign size={16}/></div><strong>{rupiah(Number(stats.totalAdded))}</strong><span className="metric-trend">Akumulasi top up manual</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Total pemakaian</span><Route size={16}/></div><strong>{rupiah(Number(stats.totalUsed))}</strong><span className="metric-trend">Pemakaian bersih dan pengurangan manual</span></article>
      <article className="metric-card"><div className="metric-card-head"><span>Total transaksi</span><ListChecks size={16}/></div><strong>{stats.transactionCount}</strong><span className="metric-trend">Catatan manual dan otomatis</span></article>
    </section>
    <BiteshipFinanceManager account={{ areaSearchCost: Number(account.areaSearchCost), rateQuoteCost: Number(account.rateQuoteCost), trackingCheckCost: Number(account.trackingCheckCost) }} entries={entries.map(entry => ({ id: entry.id, type: entry.type, amount: entry.amount.toString(), notes: entry.notes, actorId: entry.actorId, createdAt: entry.createdAt.toISOString() }))}/>
    <AdminPagination data={pagination} basePath="/admin/finance/biteship" itemLabel="transaksi"/>
  </div>;
}
