"use client";

import React, { useState, Suspense } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { StoreHeader } from "@/components/store-header";
import { errorMessage } from "@/lib/error-message";

type GoogleCredentialResponse = { credential: string };
type GoogleIdentityService = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
      renderButton: (element: HTMLElement | null, options: Record<string, string | number>) => void;
    };
  };
};

function googleIdentity() {
  return (window as Window & { google?: GoogleIdentityService }).google;
}

function LoginContent() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // States for simulated demo login
  const [demoName, setDemoName] = useState("Budi Santoso");
  const [demoEmail, setDemoEmail] = useState("budi.santoso@gmail.com");

  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/user";

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const initGoogleAuth = () => {
    if (!googleClientId) {
      console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in env.");
      return;
    }

    try {
      const g = googleIdentity();
      if (g) {
        g.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });

        g.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            shape: "rectangular",
          }
        );
      }
    } catch (e) {
      console.error("Gagal menginisialisasi Google Sign-In:", e);
    }
  };

  const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan autentikasi");
      }
      localStorage.setItem("cart_needs_merge", "true");
      window.location.href = redirectUrl;
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal login dengan akun Google."));
      setLoading(false);
    }
  };

  // Process Simulated Login for Dev/Testing
  const handleSimulatedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName.trim() || !demoEmail.trim()) {
      setError("Nama dan Email simulasi wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const simulatedCredential = `mock_:${demoEmail.trim()}:${demoName.trim()}`;
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: simulatedCredential }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan login simulasi");
      }
      localStorage.setItem("cart_needs_merge", "true");
      window.location.href = redirectUrl;
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal login simulasi."));
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleAuth}
        onReady={initGoogleAuth}
      />

      <StoreHeader />

      <main className="login-container">
        <div className="login-card">
          <div className="login-logo">REMPAHKARTA</div>
          <h1>Selamat datang</h1>
          <p>
            Masuk satu pintu menggunakan akun Google Anda untuk mengelola alamat, 
            melacak pesanan, dan menikmati proses checkout yang cepat.
          </p>

          {error && <div className="login-error">{error}</div>}

          {googleClientId ? (
            <div className="btn-wrapper">
              <div id="google-signin-btn" className="google-signin-slot"></div>
            </div>
          ) : (
            <div className="login-error">
              <strong>Info Pengembang:</strong> Client ID Google belum terkonfigurasi. 
              Gunakan panel simulasi di bawah untuk masuk.
            </div>
          )}

          {(!googleClientId || process.env.NODE_ENV === "development" || true) && (
            <>
              <div className="divider">
                <span>Mode Simulasi</span>
              </div>

              <form className="demo-box" onSubmit={handleSimulatedLogin}>
                <h3>Masuk Tanpa Google Client ID</h3>
                <div className="demo-field">
                  <label htmlFor="demo-name">Nama Lengkap</label>
                  <input
                    id="demo-name"
                    type="text"
                    required
                    value={demoName}
                    onChange={e => setDemoName(e.target.value)}
                  />
                </div>
                <div className="demo-field">
                  <label htmlFor="demo-email">Alamat Email</label>
                  <input
                    id="demo-email"
                    type="email"
                    required
                    value={demoEmail}
                    onChange={e => setDemoEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="demo-submit" disabled={loading}>
                  {loading ? "Memproses..." : "Masuk / Daftar Simulasi"}
                </button>
              </form>
            </>
          )}

          <div className="security-note">
            Dengan masuk, Anda menyetujui kebijakan privasi REMPAHKARTA. Sesi Anda dilindungi 
            oleh sistem enkripsi token JWT yang aman.
          </div>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Memuat halaman masuk...</div>}>
      <LoginContent />
    </Suspense>
  );
}
