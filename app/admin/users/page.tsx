import React from "react";
import Image from "next/image";
import Link from "next/link";
import { AdminPagination } from "@/components/admin-pagination";
import { getAdminUsersPage } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";
import { Users, UserRound } from "lucide-react";

export default async function UsersAdminPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const query = await searchParams;
  const { rows, pagination } = await getAdminUsersPage({ page: Number(query.page), pageSize: Number(query.pageSize) });

  return (
    <div className="admin-content admin-users-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Manajemen pelanggan</p>
          <h1>Pelanggan</h1>
          <p>Kelola profil pelanggan, alamat tersimpan, dan ringkasan riwayat belanja.</p>
        </div>
      </div>

      <div className="users-summary-bar"><span className="users-summary-icon"><Users size={17} aria-hidden="true" /></span><div><strong>{pagination.total}</strong><span>pelanggan terdaftar</span></div><span className="users-summary-note">Data terbaru ditampilkan lebih dahulu</span></div>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Daftar pelanggan terdaftar</caption>
            <thead>
              <tr>
                <th scope="col">Pelanggan</th>
                <th scope="col">Status</th>
                <th scope="col">Tanggal daftar</th>
                <th scope="col">Jumlah pesanan</th>
                <th scope="col">Total belanja</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td data-label="Pelanggan">
                    <div className="customer-table-profile">
                      {row.avatarUrl ? (
                        <Image
                          src={row.avatarUrl}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className="customer-table-avatar"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="customer-table-avatar fallback">
                          {row.name[0]?.toUpperCase()}
                        </span>
                      )}
                      <div>
                        <strong className="admin-table-cell-wrap">{row.name}</strong>
                        <span className="sub">
                          {row.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Status">
                    <span className={`user-status-badge ${row.status === "ACTIVE" ? "active" : row.status === "PAUSE" ? "pause" : "block"}`}>
                      {row.status === "ACTIVE" ? "Aktif" : row.status === "PAUSE" ? "Dijeda" : "Diblokir"}
                    </span>
                  </td>
                  <td data-label="Tanggal daftar">
                    {new Date(row.createdAt).toLocaleDateString("id-ID", {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td data-label="Jumlah pesanan">
                    <strong className="admin-numeric">{row.totalOrders} pesanan</strong>
                  </td>
                  <td data-label="Total belanja">
                    <strong className="admin-numeric">{rupiah(row.totalSpent)}</strong>
                  </td>
                  <td data-label="Aksi" className="admin-table-action">
                    <Link href={`/admin/users/${row.id}`} className="table-link user-detail-link" aria-label={`Lihat detail pelanggan ${row.name}`}>
                      <UserRound size={15} aria-hidden="true" /> <span>Lihat detail</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    Belum ada pelanggan terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination data={pagination} basePath="/admin/users" query={{ pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="pelanggan" />
      </section>
    </div>
  );
}
