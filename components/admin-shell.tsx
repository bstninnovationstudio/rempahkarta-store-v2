"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  RotateCcw,
  Settings,
  ShoppingBag,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type NavigationItem = readonly [href: string, label: string, icon: LucideIcon];
type NavigationSection = { label: string; items: readonly NavigationItem[] };

const navigation = [
  {
    label: "Operasional",
    items: [
      ["/admin", "Dashboard", LayoutDashboard],
      ["/admin/orders", "Pesanan", ClipboardList],
      ["/admin/products", "Produk", ShoppingBag],
      ["/admin/categories", "Kategori", FolderTree],
      ["/admin/inventory", "Inventori", Warehouse],
      ["/admin/shipments", "Pengiriman", PackageSearch],
      ["/admin/returns", "Retur & refund", RotateCcw],
      ["/admin/users", "Pelanggan", Users],
    ],
  },
  {
    label: "Sistem",
    items: [
      ["/admin/settings", "Pengaturan", Settings],
      ["/admin/audit", "Audit log", Boxes],
    ],
  },
] as const satisfies readonly NavigationSection[];

const mobileQuery = "(max-width: 1023px)";

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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const sidebarExpanded = isMobile ? mobileSidebarOpen : !desktopSidebarCollapsed;
  const allNavigationItems: NavigationItem[] = navigation.flatMap(section => section.items as readonly NavigationItem[]);
  const currentItem = allNavigationItems.find(([href]) => href === "/admin" ? path === href : path.startsWith(href));
  const currentLabel = currentItem?.[1] || "Panel admin";

  useEffect(() => {
    if (!isMobile || !mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const target = sidebarRef.current?.querySelector<HTMLElement>(".admin-nav a.active, .admin-nav a");
      target?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
        return;
      }

      if (event.key === "Tab") {
        const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || []).filter(element => !element.hasAttribute("hidden"));
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && (active === first || !sidebarRef.current?.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !sidebarRef.current?.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, mobileSidebarOpen]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin-login";
  }

  function toggleSidebar() {
    if (isMobile) setMobileSidebarOpen(current => !current);
    else setDesktopSidebarCollapsed(current => !current);
  }

  function closeMobileSidebar(restoreFocus = false) {
    setMobileSidebarOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  function closeSidebar() {
    if (isMobile) closeMobileSidebar(true);
    else setDesktopSidebarCollapsed(true);
  }

  function closeSidebarOnMobile() {
    if (isMobile) setMobileSidebarOpen(false);
  }

  return (
    <div className="admin-body">
      <div className={`admin-layout ${desktopSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside
          ref={sidebarRef}
          id="admin-navigation"
          className={`admin-sidebar ${mobileSidebarOpen ? "open" : ""}`}
          aria-label="Navigasi admin"
          aria-modal={isMobile && mobileSidebarOpen ? true : undefined}
          aria-hidden={isMobile && !mobileSidebarOpen ? true : undefined}
          role={isMobile && mobileSidebarOpen ? "dialog" : undefined}
          inert={isMobile && !mobileSidebarOpen ? true : undefined}
        >
          <div className="admin-brand">
            <Link href="/admin" className="admin-brand-link" onClick={closeSidebarOnMobile}>
              <span className="wordmark brand-wordmark">
                <Image src="/main-logo.webp" alt="" width={30} height={30} className="brand-logo-img" priority />
                REMPAHKARTA
              </span>
              <small>Commerce console</small>
            </Link>
            <button
              type="button"
              className="icon-button admin-sidebar-close"
              onClick={closeSidebar}
              aria-label={isMobile ? "Tutup navigasi" : "Ciutkan navigasi"}
            >
              <X size={18} />
            </button>
          </div>

          <div className="admin-navigation-scroll">
            {navigation.map(section => (
              <div className="admin-nav-group" key={section.label}>
                <p className="admin-nav-label">{section.label}</p>
                <nav className="admin-nav" aria-label={section.label}>
                  {section.items.map(([href, label, Icon]) => {
                    const active = href === "/admin" ? path === href : path.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={closeSidebarOnMobile}
                        className={active ? "active" : ""}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="admin-nav-icon"><Icon size={17} /></span>
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="admin-sidebar-foot">
            <button className="admin-logout" type="button" onClick={logout}>
              <LogOut size={15} />
              <span>Keluar dari admin</span>
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
            tabIndex={-1}
            onClick={() => closeMobileSidebar(true)}
            aria-label="Tutup navigasi"
          />
        )}

        <main className="admin-main" inert={isMobile && mobileSidebarOpen ? true : undefined}>
          <header className="admin-topbar">
            <div className="admin-top-left">
              <button
                ref={menuButtonRef}
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
              <div className="admin-topbar-context" aria-live="polite">
                <span>Panel admin</span>
                <strong>{currentLabel}</strong>
              </div>
            </div>
            <div className="admin-top-actions">
              <Link href="/" className="button button-light admin-store-link">Lihat toko</Link>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
