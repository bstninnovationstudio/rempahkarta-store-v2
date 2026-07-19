import { AdminPagination } from "@/components/admin-pagination";
import { getAuditLogPage } from "@/lib/admin-data";
import Link from "next/link";

const filters = [
  ["order", "Pesanan"],
  ["inventory", "Inventori"],
  ["catalog", "Katalog"],
  ["shipping", "Pengiriman"],
  ["returns", "Retur & refund"],
] as const;

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; filter?: string }> }) {
  const query = await searchParams;
  const { rows, pagination, filter } = await getAuditLogPage({ page: Number(query.page), pageSize: Number(query.pageSize), filter: query.filter });

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Tata kelola</p>
          <h1>Audit log</h1>
          <p>Jejak perubahan penting pada pesanan, stok, pembayaran, dan konfigurasi.</p>
        </div>
      </div>
      <nav className="filter-row" aria-label="Filter jenis aktivitas audit">
        <Link href="/admin/audit" aria-current={!filter ? "page" : undefined} className={`filter-chip ${!filter ? "active" : ""}`}>Semua</Link>
        {filters.map(([value, label]) => (
          <Link key={value} href={`/admin/audit?filter=${value}`} aria-current={filter === value ? "page" : undefined} className={`filter-chip ${filter === value ? "active" : ""}`}>{label}</Link>
        ))}
      </nav>
      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Jejak perubahan sistem</caption>
            <thead><tr><th scope="col">Waktu</th><th scope="col">Aktor</th><th scope="col">Aksi</th><th scope="col">Entitas</th><th scope="col">Ringkasan</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>{row.createdAt}</td>
                  <td className="admin-table-cell-wrap">{row.actor}</td>
                  <td><strong className="admin-data-code">{row.action}</strong></td>
                  <td><span className="admin-data-code">{row.entity}</span></td>
                  <td className="admin-table-cell-wrap">{row.summary}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    <div className="admin-table-empty-content">
                      <strong>Belum ada aktivitas yang tercatat</strong>
                      <span>Perubahan penting pada pesanan, stok, pembayaran, dan konfigurasi akan tampil di sini.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination data={pagination} basePath="/admin/audit" query={{ filter, pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="aktivitas" />
      </section>
    </div>
  );
}
