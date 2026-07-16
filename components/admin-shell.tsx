"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Boxes,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const nav = [
  ["/admin", "Dashboard", LayoutDashboard],
  ["/admin/orders", "Pesanan", ClipboardList],
  ["/admin/products", "Produk", ShoppingBag],
  ["/admin/categories", "Kategori", FolderTree],
  ["/admin/inventory", "Inventori", Warehouse],
  ["/admin/shipments", "Pengiriman", PackageSearch],
  ["/admin/returns", "Retur & refund", RotateCcw],
  ["/admin/users", "Pelanggan", Users],
] as const;

const mobileQuery = "(max-width: 760px)";

function subscribeMobile(callback: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getMobileSnapshot() {
  return window.matchMedia(mobileQuery).matches;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const sidebarExpanded = isMobile ? mobileSidebarOpen : !desktopSidebarCollapsed;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin-login";
  }

  function toggleSidebar() {
    if (isMobile) setMobileSidebarOpen(current => !current);
    else setDesktopSidebarCollapsed(current => !current);
  }

  function closeSidebar() {
    if (isMobile) setMobileSidebarOpen(false);
    else setDesktopSidebarCollapsed(true);
  }

  function closeSidebarOnMobile() {
    if (isMobile) setMobileSidebarOpen(false);
  }

  return (
    <div className="admin-body">
      <div className={`admin-layout ${desktopSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside
          id="admin-navigation"
          className={`admin-sidebar ${mobileSidebarOpen ? "open" : ""}`}
          aria-label="Navigasi admin"
        >
          <div className="admin-brand">
            <span className="wordmark brand-wordmark">
              <img src="/main-logo.webp" alt="" className="brand-logo-img" />
              REMPAHKARTA
            </span>
            <small>Commerce<br />Console</small>
            <button
              type="button"
              className="icon-button admin-sidebar-close"
              onClick={closeSidebar}
              aria-label={isMobile ? "Tutup navigasi" : "Ciutkan navigasi"}
            >
              <X size={18} />
            </button>
          </div>

          <p className="admin-nav-label">Operasional</p>
          <nav className="admin-nav">
            {nav.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                onClick={closeSidebarOnMobile}
                className={path === href || href !== "/admin" && path.startsWith(href) ? "active" : ""}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>

          <p className="admin-nav-label">Sistem</p>
          <nav className="admin-nav">
            <Link href="/admin/settings" onClick={closeSidebarOnMobile} className={path === "/admin/settings" ? "active" : ""}>
              <Settings size={17} />
              Pengaturan
            </Link>
            <Link href="/admin/audit" onClick={closeSidebarOnMobile} className={path === "/admin/audit" ? "active" : ""}>
              <Boxes size={17} />
              Audit log
            </Link>
          </nav>

          <div className="admin-sidebar-foot">
            <button className="admin-logout" type="button" onClick={logout}>
              <LogOut size={15} />
              Keluar
            </button>
            <div className="admin-user">
              <span className="admin-avatar">RK</span>
              <div>
                <strong>Admin REMPAHKARTA</strong>
                <span>Owner</span>
              </div>
            </div>
          </div>
        </aside>

        {mobileSidebarOpen && (
          <button
            type="button"
            className="admin-sidebar-scrim"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Tutup navigasi"
          />
        )}

        <main className="admin-main">
          <header className="admin-topbar">
            <div className="admin-top-left">
              <button
                className="icon-button admin-menu-button"
                type="button"
                aria-label={sidebarExpanded ? "Tutup navigasi" : "Buka navigasi"}
                aria-expanded={sidebarExpanded}
                aria-controls="admin-navigation"
                onClick={toggleSidebar}
              >
                <Menu size={19} />
              </button>
              {path !== "/admin" && (
                <button className="icon-button admin-back-button" type="button" aria-label="Kembali" onClick={() => router.back()}>
                  <ArrowLeft size={18} />
                </button>
              )}
              <label className="admin-search">
                <Search size={15} />
                <input placeholder="Cari pesanan, produk, atau SKU…" aria-label="Cari admin" />
              </label>
            </div>
            <div className="admin-top-actions">
              <button className="icon-button" aria-label="Notifikasi">
                <Bell size={18} />
              </button>
              <Link href="/" className="button button-light admin-store-link">Lihat toko</Link>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
