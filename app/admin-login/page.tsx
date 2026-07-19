"use client";

import Image from "next/image";
import Script from "next/script";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useTurnstile } from "@/components/use-turnstile";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (process.env.NEXT_PUBLIC_APP_MODE !== "production" ? "1x00000000000000000000BB" : "");

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
      <main className="simple-page admin-login-page">
        <form className="panel admin-login-card" onSubmit={submit} aria-busy={busy}>
        <div className="admin-login-brand">
          <Image src="/main-logo.webp" alt="" width={42} height={42} priority />
          <div>
            <strong>REMPAHKARTA</strong>
            <span>Commerce console</span>
          </div>
        </div>

        <div className="page-title">
          <span className="admin-login-icon" aria-hidden="true"><LockKeyhole size={18} /></span>
          <p className="eyebrow">Akses operasional</p>
          <h1>Masuk ke panel admin</h1>
          <p>Kelola pesanan, katalog, inventori, dan layanan pelanggan melalui akses yang terlindungi.</p>
        </div>

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
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "admin-login-error" : undefined}
          />
        </div>

          {error && <p id="admin-login-error" className="form-error" role="alert">{error}</p>}

          <button type="submit" className="button button-dark" disabled={busy}>
            {busy ? "Memeriksa akses…" : "Masuk ke dashboard"}
          </button>
          <div ref={containerRef} className="turnstile-container" aria-live="polite" />
          <p className="admin-login-note">Akses ini khusus pengelola REMPAHKARTA. Jangan membagikan kredensial admin.</p>
        </form>
      </main>
    </>
  );
}
