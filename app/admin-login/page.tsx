"use client";

import Image from "next/image";
import Script from "next/script";
import { useState } from "react";
import { useTurnstile } from "@/components/use-turnstile";

const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  (process.env.NEXT_PUBLIC_APP_MODE !== "production" ? "1x00000000000000000000BB" : "");

export default function AdminLogin() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { containerRef, token: getTurnstileToken } = useTurnstile(turnstileSiteKey);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const turnstileToken = await getTurnstileToken("admin_login");
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password"), turnstileToken }),
      });

      if (response.ok) {
        location.href = "/admin";
        return;
      }

      setError("Email atau password tidak sesuai.");
    } catch {
      setError("Panel admin belum dapat dihubungi. Periksa koneksi, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <main className="login-container admin-login-container">
        <form className="login-card admin-login-card" onSubmit={submit} aria-busy={busy}>
          <header className="login-header">
            <div className="login-logo-circle">
              <Image src="/main-logo.webp" alt="REMPAHKARTA Logo" width={52} height={52} className="login-logo-img" priority unoptimized />
            </div>
            <h1 className="login-logo-text">Masuk ke Panel Admin</h1>
          </header>
          <p className="login-subtitle">
            Akses konsol operasional REMPAHKARTA untuk mengelola pesanan, katalog, inventori, dan layanan pelanggan.
          </p>

          <div className="field">
            <label htmlFor="admin-email">Email admin</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="admin@rempahkarta.com"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-login-error" : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-login-error" : undefined}
            />
          </div>

          {error && (
            <div id="admin-login-error" className="login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="button button-dark button-block" disabled={busy}>
            {busy ? "Memeriksa akses…" : "Masuk ke Dashboard"}
          </button>

          <div ref={containerRef} className="turnstile-container" aria-live="polite" />

          <div className="admin-login-note">
            Akses khusus pengelola REMPAHKARTA. Sesi terenkripsi dan dilindungi secara aman.
          </div>
        </form>
      </main>
    </>
  );
}

