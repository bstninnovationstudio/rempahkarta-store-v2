import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Clock3,
  FolderTree,
  PackageSearch,
  RotateCcw,
  Settings,
  ShoppingBag,
  Ticket,
  Users,
  WalletCards,
  Warehouse,
  XCircle,
} from "lucide-react";
import { getAdminDashboardData } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";

const shortcutSections = [
  {
    label: "Operasional",
    items: [
      { href: "/admin/orders", label: "Pesanan", desc: "Kelola daftar pesanan & status", icon: ClipboardList },
      { href: "/admin/products", label: "Produk", desc: "Katalog & varian produk", icon: ShoppingBag },
      { href: "/admin/categories", label: "Kategori", desc: "Pengelompokan kategori", icon: FolderTree },
      { href: "/admin/inventory", label: "Inventori", desc: "Stok gudang & tingkat varian", icon: Warehouse },
      { href: "/admin/vouchers", label: "Voucher", desc: "Manajemen voucher promo", icon: Ticket },
      { href: "/admin/returns", label: "Retur & refund", desc: "Pengajuan & resolusi retur", icon: RotateCcw },
      { href: "/admin/users", label: "Pelanggan", desc: "Daftar & riwayat akun", icon: Users },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { href: "/admin/finance/omzet", label: "Dana omzet", desc: "Buku besar omzet & penarikan", icon: WalletCards },
      { href: "/admin/finance/biteship", label: "Dana Biteship", desc: "Shadow balance & deposit kurir", icon: PackageSearch },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/admin/settings", label: "Pengaturan", desc: "Konfigurasi toko & gudang", icon: Settings },
      { href: "/admin/audit", label: "Audit log", desc: "Riwayat aktivitas & mutasi", icon: Boxes },
    ],
  },
] as const;

export default async function AdminDashboard() {
  const { stats } = await getAdminDashboardData();

  return (
    <div className="admin-content admin-dashboard-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Operasional toko</p>
          <h1>Ringkasan operasional</h1>
          <p>Pemantauan data transaksi real-time dan akses cepat navigasi toko.</p>
        </div>
        <Link href="/admin/products/new" className="button button-dark">
          Tambah produk
        </Link>
      </div>

      <section className="metrics-grid" aria-label="Ringkasan operasional">
        <Link href="/admin/orders?filter=processing" className="metric-card metric-card-link">
          <div className="metric-card-head">
            <span>Perlu diproses</span>
            <Clock3 size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric">{stats.needProcess}</strong>
          <span className="metric-trend tone-warning">Pesanan lunas yang perlu disiapkan</span>
        </Link>

        <Link href="/admin/orders?filter=cancel" className="metric-card metric-card-link">
          <div className="metric-card-head">
            <span>Pengajuan Pembatalan</span>
            <XCircle size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric">{stats.canceledOrders}</strong>
          <span className="metric-trend">Pesanan yang sedang mengajukan pembatalan</span>
        </Link>

        <Link href="/admin/orders?filter=issue" className="metric-card metric-card-link">
          <div className="metric-card-head">
            <span>Pesanan Bermasalah</span>
            <AlertTriangle size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric">{stats.issueOrders}</strong>
          <span className="metric-trend tone-warning">Pesanan yang mengalami kendala/isu</span>
        </Link>

        <Link href="/admin/returns" className="metric-card metric-card-link">
          <div className="metric-card-head">
            <span>Refund</span>
            <RotateCcw size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric">{stats.reviewReturns}</strong>
          <span className="metric-trend tone-warning">Pengajuan retur/refund perlu ditinjau</span>
        </Link>

        <Link href="/admin/finance/omzet" className="metric-card metric-card-link metric-card-span-2">
          <div className="metric-card-head">
            <span>Saldo Tertahan</span>
            <Clock3 size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric admin-metric-money">{rupiah(stats.heldBalance)}</strong>
          <span className="metric-trend tone-warning">Pesanan aktif, isu, pembatalan, atau retur</span>
        </Link>

        <Link href="/admin/finance/omzet" className="metric-card metric-card-link metric-card-span-2">
          <div className="metric-card-head">
            <span>Saldo Bebas</span>
            <WalletCards size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric admin-metric-money">{rupiah(stats.availableBalance)}</strong>
          <span className="metric-trend">Dana bersih dari pesanan yang sudah selesai</span>
        </Link>
      </section>

      <section className="admin-shortcuts-section" aria-label="Pintasan navigasi">
        <div className="section-inline-head">
          <div>
            <h2>Pintasan Navigasi</h2>
            <p>Akses langsung ke seluruh menu pengelolaan konsol admin.</p>
          </div>
        </div>

        <div className="admin-shortcuts-stack">
          {shortcutSections.map((section) => (
            <div key={section.label} className="admin-shortcut-group">
              <h3 className="admin-shortcut-group-title">{section.label}</h3>
              <div className="admin-shortcut-grid">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="admin-shortcut-card">
                      <div className="admin-shortcut-icon">
                        <Icon size={18} />
                      </div>
                      <div className="admin-shortcut-info">
                        <div className="admin-shortcut-head">
                          <strong>{item.label}</strong>
                          <ArrowUpRight size={14} className="admin-shortcut-arrow" />
                        </div>
                        <p>{item.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
