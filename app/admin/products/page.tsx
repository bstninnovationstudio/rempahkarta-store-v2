import Image from "next/image";
import Link from "next/link";
import { FolderTree, Plus } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { getProductRowsPage } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";

function productStatusLabel(status: string) {
  if (status === "active") return "Aktif";
  if (status === "draft") return "Draf";
  if (status === "archived") return "Diarsipkan";
  return status;
}

function productStatusClass(status: string) {
  if (status === "active") return "status-paid";
  if (status === "draft") return "status-pending";
  if (status === "archived") return "status-cancelled";
  return "";
}

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const query = await searchParams;
  const { rows, pagination } = await getProductRowsPage({ page: Number(query.page), pageSize: Number(query.pageSize) });

  return (
    <div className="admin-content admin-products-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Manajemen katalog</p>
          <h1>Produk</h1>
          <p>Kelola informasi, variasi, media, harga, dan publikasi produk.</p>
        </div>
        <div className="head-actions">
          <Link href="/admin/categories" className="button button-light"><FolderTree size={15} aria-hidden="true" /> Kategori</Link>
          <Link href="/admin/products/new" className="button button-dark"><Plus size={15} aria-hidden="true" /> Tambah produk</Link>
        </div>
      </div>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Daftar produk dalam katalog</caption>
            <thead>
              <tr>
                <th scope="col">Produk</th>
                <th scope="col">SKU utama</th>
                <th scope="col">Harga mulai</th>
                <th scope="col">Stok tersedia</th>
                <th scope="col">Status</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="product-table-profile">
                      <span className="order-thumb"><Image unoptimized src={row.image} alt="" fill /></span>
                      <span>
                        <strong>{row.name}</strong>
                        <span className="sub">{row.category} · {row.color}</span>
                      </span>
                    </div>
                  </td>
                  <td><span className="admin-data-code">{row.sku}</span></td>
                  <td><strong className="admin-numeric">{rupiah(row.price)}</strong></td>
                  <td>
                    <span className={`inventory-number inventory-number-compact admin-numeric ${row.isLow ? "inventory-low" : ""}`}>{row.stock}</span>
                    {row.isLow && <span className="sub">Stok menipis atau habis</span>}
                  </td>
                  <td><span className={`status-pill ${productStatusClass(row.status)}`}>{productStatusLabel(row.status)}</span></td>
                  <td><Link href={`/admin/products/${row.id}`} className="table-link">Edit<span aria-hidden="true"> →</span></Link></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="table-empty-state" colSpan={6}>
                    <div className="admin-table-empty-content">
                      <strong>Belum ada produk di katalog</strong>
                      <span>Tambahkan produk pertama untuk mulai mengelola katalog.</span>
                      <Link href="/admin/products/new" className="table-link">Tambah produk</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination data={pagination} basePath="/admin/products" query={{ pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) }} itemLabel="produk" />
      </section>
    </div>
  );
}
