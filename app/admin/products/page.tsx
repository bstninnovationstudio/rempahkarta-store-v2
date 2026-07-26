import Image from "next/image";
import Link from "next/link";
import { Archive, FolderTree, Plus } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { CatalogOrderControls } from "@/components/catalog-order-controls";
import { ProductTableActions } from "@/components/product-table-actions";
import { getProductRowsPage } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";

function productStatusLabel(status: string) { return status === "active" ? "Aktif" : status === "draft" ? "Draf" : "Diarsipkan"; }
function productStatusClass(status: string) { return status === "active" ? "status-paid" : status === "draft" ? "status-pending" : "status-cancelled"; }
type ProductPageData = Awaited<ReturnType<typeof getProductRowsPage>>;

function ProductTable({ title, caption, rows, pagination, archived, otherPage }: { title: string; caption: string; rows: ProductPageData["rows"]; pagination: ProductPageData["pagination"]; archived: boolean; otherPage?: string }) {
  const basePath = "/admin/products";
  const pageQuery = { ...(otherPage ? { [archived ? "page" : "archivedPage"]: otherPage } : {}), pageSize: pagination.pageSize === 20 ? undefined : String(pagination.pageSize) };
  return <section className={`table-card product-list-card${archived ? " product-list-archived" : ""}`} aria-label={title}>
    <div className="product-list-head"><div><h2>{title}</h2><p>{pagination.total} produk</p></div>{archived && <Archive size={17} aria-hidden="true"/>}</div>
    <div className="admin-table-wrap"><table className="admin-table product-table"><caption className="admin-table-caption">{caption}</caption><thead><tr><th scope="col">Urutan</th><th scope="col">Produk</th><th scope="col">SKU utama</th><th scope="col">Harga mulai</th><th scope="col">Stok tersedia</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td><CatalogOrderControls endpoint={`/api/admin/products/${row.id}/position`} label={row.name} isFirst={pagination.from === 1 && index === 0} isLast={pagination.to === pagination.total && index === rows.length - 1}/></td><td><div className="product-table-profile"><span className="order-thumb"><Image unoptimized src={row.image} alt="" fill /></span><span><strong>{row.name}</strong><span className="sub">{row.category} · {row.color}</span></span></div></td><td><span className="admin-data-code">{row.sku}</span></td><td><strong className="admin-numeric">{rupiah(row.price)}</strong></td><td><span className={`inventory-number inventory-number-compact admin-numeric ${row.isLow ? "inventory-low" : ""}`}>{row.stock}</span>{row.isLow && <span className="sub">Stok menipis atau habis</span>}</td><td><span className={`status-pill ${productStatusClass(row.status)}`}>{productStatusLabel(row.status)}</span></td><td><ProductTableActions id={row.id} name={row.name} /></td></tr>)}{!rows.length && <tr><td className="table-empty-state" colSpan={7}><div className="admin-table-empty-content"><strong>{archived ? "Belum ada produk diarsipkan" : "Belum ada produk aktif atau draf"}</strong><span>{archived ? "Produk yang diarsipkan akan tetap tercatat di sini." : "Tambahkan produk pertama untuk mulai mengelola katalog."}</span>{!archived && <Link href="/admin/products/new" className="table-link">Tambah produk</Link>}</div></td></tr>}</tbody></table></div>
    <AdminPagination data={pagination} basePath={basePath} query={pageQuery} pageParam={archived ? "archivedPage" : "page"} itemLabel="produk" />
  </section>;
}

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ page?: string; archivedPage?: string; pageSize?: string }> }) {
  const query = await searchParams;
  const [active, archived] = await Promise.all([
    getProductRowsPage({ page: Number(query.page), pageSize: Number(query.pageSize), archived: false }),
    getProductRowsPage({ page: Number(query.archivedPage), pageSize: Number(query.pageSize), archived: true }),
  ]);
  return <div className="admin-content admin-products-page"><div className="admin-page-head"><div><p className="eyebrow">Manajemen katalog</p><h1>Produk</h1><p>Atur urutan katalog, informasi, variasi, media, harga, dan publikasi produk.</p></div><div className="head-actions"><Link href="/admin/categories" className="button button-light"><FolderTree size={15}/> Kategori</Link><Link href="/admin/products/new" className="button button-dark"><Plus size={15}/> Tambah produk</Link></div></div><ProductTable title="Produk aktif & draf" caption="Daftar produk yang tersedia untuk dikelola pada katalog" rows={active.rows} pagination={active.pagination} archived={false} otherPage={archived.pagination.page > 1 ? String(archived.pagination.page) : undefined}/><ProductTable title="Produk diarsipkan" caption="Daftar produk yang disimpan sebagai arsip" rows={archived.rows} pagination={archived.pagination} archived otherPage={active.pagination.page > 1 ? String(active.pagination.page) : undefined}/></div>;
}
