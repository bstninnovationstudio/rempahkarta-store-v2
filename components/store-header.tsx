"use client";

import Link from "next/link";
import { ArrowUpRight, LogIn, Menu, Search, ShoppingBag, X, Smartphone, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function StoreHeader() {
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<{ name: string; email: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    setOpen(false);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      alert(
        "Cara pasang REMPAHKARTA di Layar Utama:\n\n" +
        "• Android (Chrome):\n  Klik menu titik tiga di kanan atas Chrome, lalu pilih 'Instal aplikasi' atau 'Tambahkan ke Layar Utama'.\n\n" +
        "• iOS / iPhone (Safari):\n  Klik tombol 'Bagikan' (Share) di bagian bawah Safari, lalu pilih 'Tambahkan ke Layar Utama' (Add to Home Screen)."
      );
    }
  }

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch {}
      setLoading(false);
    }
    checkUser();
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeMenuButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    function updateCount() {
      try {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const count = cart.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0);
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    }
    updateCount();
    window.addEventListener("cart-updated", updateCount);
    window.addEventListener("storage", updateCount);
    return () => {
      window.removeEventListener("cart-updated", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  return (
    <header className="store-header">
      <div className="store-header-inner">
        <button
          className="icon-button mobile-only"
          aria-label="Buka menu"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(true)}
        ><Menu size={20} /></button>
        <Link href="/" className="wordmark brand-wordmark" aria-label="REMPAHKARTA beranda"><img src="/main-logo.webp" alt="" className="brand-logo-img" />REMPAHKARTA</Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <Link href="/#product">Produk</Link><Link href="/#values">Nilai Utama</Link><Link href="/#guarantee">Garansi</Link><Link href="/#legal">Legalitas</Link><Link href="/#contact">Kontak</Link>
        </nav>
        <div className="header-actions">
          <Link className="icon-button" href="/?search=1" aria-label="Cari produk"><Search size={20} /></Link>
          <Link className="icon-button bag-button" href="/cart" aria-label="Keranjang">
            <ShoppingBag size={20} />
            {cartCount > 0 && <span>{cartCount}</span>}
          </Link>
          {!loading && (
            user ? (
              <div className="account-menu">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="account-trigger"
                  aria-label={`Buka menu akun ${user.name}`}
                  aria-expanded={dropdownOpen}
                >
                  {user.avatarUrl && !avatarFailed ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="account-avatar-image"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span className="account-avatar-fallback">
                      {user.name[0]?.toUpperCase()}
                    </span>
                  )}
                </button>
                {dropdownOpen && (
                  <div className="account-dropdown">
                    <Link href="/user" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                      Dashboard
                    </Link>
                    <Link href="/user/orders" className="dropdown-link" onClick={() => setDropdownOpen(false)}>
                      Riwayat Belanja
                    </Link>
                    <hr />
                    <button
                      className="account-logout"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" });
                        window.location.href = "/";
                      }}
                    >
                      Keluar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="button header-login" aria-label="Masuk ke akun">
                <LogIn size={16} aria-hidden="true" />
                <span>Masuk</span>
              </Link>
            )
          )}
        </div>
      </div>
      {open && typeof document !== "undefined" ? createPortal(
        <div className="mobile-menu-layer">
          <button className="mobile-menu-scrim" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <aside
            className="mobile-menu"
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi utama"
          >
            <div className="mobile-menu-head">
              <Link href="/" className="wordmark brand-wordmark" onClick={() => setOpen(false)}>
                <img src="/main-logo.webp" alt="" className="brand-logo-img" />REMPAHKARTA
              </Link>
              <button
                ref={closeMenuButtonRef}
                className="icon-button mobile-menu-close"
                aria-label="Tutup menu"
                onClick={() => setOpen(false)}
              ><X size={20}/></button>
            </div>

            <div className="mobile-menu-body">
              <nav className="mobile-menu-group" aria-label="Jelajahi REMPAHKARTA">
                <p>Jelajahi</p>
                <Link href="/#product" onClick={() => setOpen(false)}><span>Produk</span><span>01</span></Link>
                <Link href="/#values" onClick={() => setOpen(false)}><span>Nilai utama</span><span>02</span></Link>
                <Link href="/#guarantee" onClick={() => setOpen(false)}><span>Garansi</span><span>03</span></Link>
                <Link href="/#legal" onClick={() => setOpen(false)}><span>Legalitas</span><span>04</span></Link>
                <Link href="/#contact" onClick={() => setOpen(false)}><span>Kontak</span><span>05</span></Link>
              </nav>

              <nav className="mobile-menu-group mobile-account-links" aria-label="Menu akun">
                <p>Akun</p>
                {user ? (
                  <>
                    <Link href="/user" onClick={() => setOpen(false)}><span>Dashboard saya</span><ArrowUpRight size={17}/></Link>
                    <Link href="/user/orders" onClick={() => setOpen(false)}><span>Riwayat belanja</span><ArrowUpRight size={17}/></Link>
                  </>
                ) : (
                  <Link className="mobile-menu-login" href="/login" onClick={() => setOpen(false)}>
                    <span>Masuk akun</span><LogIn size={17}/>
                  </Link>
                )}
                <button className="mobile-menu-install" onClick={handleInstallClick}>
                  <span>Install App</span><Smartphone size={17}/>
                </button>
                {user && (
                  <button className="mobile-menu-logout"
                    onClick={async () => {
                      setOpen(false);
                      await fetch("/api/auth/logout", { method: "POST" });
                      window.location.href = "/";
                    }}
                  >
                    <span>Keluar</span><LogOut size={17}/>
                  </button>
                )}
              </nav>
            </div>

            <div className="mobile-menu-foot">
              <span>© 2026 REMPAHKARTA. Seluruh hak cipta dilindungi.</span>
            </div>
          </aside>
        </div>,
        document.body,
      ) : null}
    </header>
  );
}
