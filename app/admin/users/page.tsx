import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { rupiah } from "@/lib/format";

export default async function UsersAdminPage() {
  const users = await prisma.user.findMany({
    include: {
      orders: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate statistics for each user
  const rows = users.map(user => {
    const totalOrders = user.orders.length;
    const totalSpent = user.orders
      .filter(o => o.paymentState === "paid" || o.fulfillmentState === "completed")
      .reduce((sum, o) => sum + Number(o.grandTotal), 0);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      totalOrders,
      totalSpent,
    };
  });

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Customer management</p>
          <h1>Pelanggan</h1>
          <p>Lihat data pelanggan terdaftar, buku alamat, dan riwayat belanja mereka.</p>
        </div>
      </div>

      <section className="table-card">
        <div className="table-toolbar">
          <input className="customer-search-input" placeholder="Cari pelanggan berdasarkan nama atau email…" />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Tanggal Daftar</th>
                <th>Jumlah Pesanan</th>
                <th>Total Belanja</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="customer-table-profile">
                      {row.avatarUrl ? (
                        <img
                          src={row.avatarUrl}
                          alt=""
                          className="customer-table-avatar"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="customer-table-avatar fallback">
                          {row.name[0]?.toUpperCase()}
                        </span>
                      )}
                      <div>
                        <strong>{row.name}</strong>
                        <span className="sub">
                          {row.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {new Date(row.createdAt).toLocaleDateString("id-ID", {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td>
                    <strong>{row.totalOrders} pesanan</strong>
                  </td>
                  <td>
                    <strong>{rupiah(row.totalSpent)}</strong>
                  </td>
                  <td>
                    <Link href={`/admin/users/${row.id}`} className="table-link">
                      Lihat rincian →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    Belum ada pelanggan terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
