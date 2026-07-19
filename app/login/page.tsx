"use client";

import React, { useRef, useState, Suspense } from "react";
import Script from "next/script";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { StoreHeader } from "@/components/store-header";
import { errorMessage } from "@/lib/error-message";
import { safeInternalPath } from "@/lib/safe-redirect";
import { LoaderCircle } from "lucide-react";

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
  const googleInitializedRef = useRef(false);
  const authInFlightRef = useRef(false);

  const searchParams = useSearchParams();
  const redirectUrl = safeInternalPath(searchParams.get("redirect"), "/user");

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const initGoogleAuth = () => {
    if (!googleClientId) {
      console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in env.");
      return;
    }

    try {
      const g = googleIdentity();
      const buttonSlot = document.getElementById("google-signin-btn");
      if (g && buttonSlot && !googleInitializedRef.current) {
        googleInitializedRef.current = true;
        g.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });

        g.accounts.id.renderButton(
          buttonSlot,
          {
            theme: "outline",
            size: "large",
            width: typeof window !== "undefined" ? Math.min(320, Math.max(200, window.innerWidth - 80)) : 320,
            text: "continue_with",
            shape: "rectangular",
          }
        );
      }
    } catch (e) {
      googleInitializedRef.current = false;
      console.error("Gagal menginisialisasi Google Sign-In:", e);
    }
  };

  const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
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
      window.location.href = data.completion?.isComplete
        ? redirectUrl
        : `/user/settings?onboarding=1&redirect=${encodeURIComponent(redirectUrl)}`;
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal login dengan akun Google."));
      authInFlightRef.current = false;
      setLoading(false);
    }
  };

  // Google Sign-In is used as the primary authentication method
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
          <header className="login-header">
            <div className="login-logo-circle">
              <Image src="/main-logo.webp" alt="REMPAHKARTA Logo" width={52} height={52} className="login-logo-img" unoptimized />
            </div>
            <h1 className="login-logo-text">Selamat datang</h1>
          </header>
          <p>
            Masuk satu pintu menggunakan akun Google Anda untuk mengelola alamat, 
            melacak pesanan, dan menikmati proses checkout yang cepat.
          </p>

          {error && <div className="login-error" role="alert">{error}</div>}

          {googleClientId ? (
            <div className={`btn-wrapper login-button-wrapper${loading ? " is-loading" : ""}`} aria-busy={loading}>
              <div id="google-signin-btn" className="google-signin-slot"></div>
              {loading && (
                <div className="login-auth-progress" role="status" aria-live="polite">
                  <LoaderCircle size={18} aria-hidden="true" /> Memverifikasi akun…
                </div>
              )}
            </div>
          ) : (
            <div className="login-error" role="alert">
              <strong>Info Pengembang:</strong> Client ID Google belum terkonfigurasi di env. 
              Silakan konfigurasikan NEXT_PUBLIC_GOOGLE_CLIENT_ID terlebih dahulu.
            </div>
          )}

          <div className="login-policy-note">
            Dengan masuk atau mendaftar, Anda menyetujui <a href="/pages/shipping">Ketentuan Layanan</a> serta <a href="/pages/returns">Kebijakan Privasi & Retur</a> kami. Sesi Anda terenkripsi dan dilindungi secara aman.
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
