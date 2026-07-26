"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, RefreshCw, X } from "lucide-react";
import { StoreHeader } from "@/components/store-header";
import { rupiah } from "@/lib/format";
import Link from "next/link";
import Script from "next/script";
import { useTurnstile } from "@/components/use-turnstile";

interface PaymentPageClientProps {
  number: string;
  subtotal?: number;
  shippingFee?: number;
  voucherCode?: string | null;
  discountAmount?: number;
  serviceFee?: number;
  payableAmount: number;
  uniqueCode: number;
  expiresAt: string | null;
  qrisImageUrl: string | null;
  qrisString: string | null;
  initialStatus: string;
  turnstileSiteKey: string;
}

export function PaymentPageClient({
  number,
  subtotal,
  shippingFee,
  voucherCode,
  discountAmount = 0,
  serviceFee,
  payableAmount,
  uniqueCode,
  expiresAt,
  qrisImageUrl,
  initialStatus,
  turnstileSiteKey,
}: PaymentPageClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(initialStatus);
  const [timeLeft, setTimeLeft] = useState<string>("10:00");
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const { containerRef, token: getTurnstileToken } = useTurnstile(turnstileSiteKey);

  // Target expiration time ref
  const expiryTimeRef = useRef<number>(0);

  // 1. Countdown Timer Effect
  useEffect(() => {
    if (expiryTimeRef.current === 0) {
      expiryTimeRef.current = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 10 * 60 * 1000;
    }

    if (["paid", "canceled", "failed", "denied", "expired"].includes(status)) {
      return;
    }

    let timerInterval: ReturnType<typeof setInterval> | null = null;

    const updateTimer = () => {
      const now = Date.now();
      const diff = expiryTimeRef.current - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        setIsExpired(true);
        setStatus("expired");
        if (timerInterval) clearInterval(timerInterval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(
          `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      }
    };

    updateTimer(); // Initial call
    timerInterval = setInterval(updateTimer, 1000);

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [status, expiresAt]);

  // 2. Auto-Polling Effect (checks database only, every 3 seconds)
  useEffect(() => {
    if (["paid", "canceled", "failed", "denied", "expired"].includes(status)) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(number)}/payment/status`
        );
        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.status && data.status !== status) {
          setStatus(data.status);
          if (data.status === "paid") {
            router.push(`/orders/${encodeURIComponent(number)}`);
          }
        }
      } catch {
        // Silently ignore polling network errors
      }
    };

    const pollingInterval = setInterval(pollStatus, 3000);
    return () => clearInterval(pollingInterval);
  }, [number, status, router]);

  // 3. Manual Sync/Refresh (calls BSTN directly and updates local database)
  const handleSync = async () => {
    if (isSyncing || ["paid", "canceled", "failed", "denied", "expired"].includes(status)) {
      return;
    }

    setIsSyncing(true);
    setError("");

    try {
      const turnstileToken = await getTurnstileToken("payment_sync");
      const response = await fetch(
        `/api/orders/${number}/payment/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnstileToken }),
        }
      );

      const text = await response.text();
      let data: { success?: boolean; status?: string; error?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Respons server tidak valid.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyelaraskan status pembayaran.");
      }

      if (data.success && data.status) {
        setStatus(data.status);
        if (data.status === "paid") {
          router.push(`/orders/${encodeURIComponent(number)}`);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menghubungi server untuk perbaruan.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Cancel Payment & Order (calls BSTN cancel endpoint and releases stock reservation)
  const handleCancel = async () => {
    if (
      isCancelling ||
      !confirm("Apakah Anda yakin ingin membatalkan pesanan dan pembayaran ini?")
    ) {
      return;
    }

    setIsCancelling(true);
    setError("");

    try {
      const response = await fetch(`/api/orders/${number}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Pembatalan oleh pelanggan" }),
      });

      const text = await response.text();
      let data: { success?: boolean; status?: string; error?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Respons server tidak valid.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Gagal membatalkan pesanan.");
      }

      if (data.success && data.status) {
        setStatus(data.status);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan pesanan. Silakan coba kembali.");
    } finally {
      setIsCancelling(false);
    }
  };

  const isTerminalState = ["paid", "canceled", "failed", "denied", "expired"].includes(status);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <StoreHeader />
      <main className="simple-page payment-page">
        <div ref={containerRef} className="turnstile-hidden" aria-live="polite" />
        <Link href={`/orders/${encodeURIComponent(number)}`} className="eyebrow payment-back">
          <ArrowLeft size={13} /> Detail pesanan
        </Link>

        <section className="panel payment-card">
          {/* Main Status Header */}
          <div className="payment-head">
            <p className="eyebrow">Pembayaran QRIS</p>
            <h1>{number}</h1>
            
            {/* Elegant text timer instead of aggressive flashing UI */}
            {!isTerminalState && (
              <p className="payment-timer">
                Selesaikan pembayaran sebelum batas waktu berakhir:<br />
                <span>{timeLeft}</span>
              </p>
            )}
          </div>

          {/* QR Code Container with Overlay */}
          <div className="qris-frame">
            {qrisImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrisImageUrl}
                alt="Kode QRIS pembayaran"
              />
            ) : (
              <div className="qris-fallback">
                <AlertCircle size={24} />
                <span>Gambar QRIS tidak dapat dimuat.</span>
              </div>
            )}

            {/* Overlays for Expired or Canceled status */}
            {(isExpired || status === "expired" || status === "expired_resolved") && (
              <div className="qris-overlay expired">
                <div className="qris-status-icon"><X size={24} /></div>
                <strong>Pembayaran kedaluwarsa</strong>
                <p>Batas waktu 10 menit telah terlampaui.</p>
              </div>
            )}

            {status === "canceled" && (
              <div className="qris-overlay canceled">
                <div className="qris-status-icon"><X size={24} /></div>
                <strong>Pembayaran dibatalkan</strong>
                <p>Pesanan ini telah dibatalkan.</p>
              </div>
            )}

            {status === "paid" && (
              <div className="qris-overlay paid">
                <div className="qris-status-icon"><Check size={24} /></div>
                <strong>Pembayaran berhasil</strong>
                <p>Mengarahkan kembali ke pesanan…</p>
              </div>
            )}
          </div>

          {/* Pricing snapshot list */}
          {(() => {
            const hasItemDetails = subtotal !== undefined && shippingFee !== undefined;
            const totalServiceFee = serviceFee || 0;
            const fallbackBase = Math.max(0, payableAmount - totalServiceFee - uniqueCode);

            return (
              <div className="detail-list payment-detail-list">
                {hasItemDetails ? (
                  <>
                    <div>
                      <span>Subtotal Produk</span>
                      <span>{rupiah(subtotal)}</span>
                    </div>
                    <div>
                      <span>Ongkos Kirim</span>
                      <span>{rupiah(shippingFee)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div>
                        <span>Diskon Promo ({voucherCode || "PROMO"})</span>
                        <span className="tone-success">-{rupiah(discountAmount)}</span>
                      </div>
                    )}
                    {totalServiceFee > 0 && (
                      <div>
                        <span>Biaya Layanan</span>
                        <span>{rupiah(totalServiceFee)}</span>
                      </div>
                    )}
                    {uniqueCode > 0 && (
                      <div>
                        <span>Nomor Acak Unik</span>
                        <span>{rupiah(uniqueCode)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <span>Subtotal & Ongkir</span>
                      <span>{rupiah(fallbackBase)}</span>
                    </div>
                    {totalServiceFee > 0 && (
                      <div>
                        <span>Biaya Layanan</span>
                        <span>{rupiah(totalServiceFee)}</span>
                      </div>
                    )}
                    {uniqueCode > 0 && (
                      <div>
                        <span>Nomor Acak Unik</span>
                        <span>{rupiah(uniqueCode)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="payment-total">
                  <span>Total Pembayaran</span>
                  <strong>{rupiah(payableAmount)}</strong>
                </div>
              </div>
            );
          })()}

          {/* Important instructions */}
          {!isTerminalState && (
            <div className="payment-instruction">
              <AlertCircle size={16} />
              <div>
                <strong>Penting:</strong> Pindai QRIS dengan aplikasi pembayaran pilihan Anda. Pastikan nominal pembayaran sama persis hingga digit terakhir (Nomor Acak Unik) agar transaksi terverifikasi.
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="form-alert payment-error">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="payment-actions">
            {!isTerminalState ? (
              <>
                <button
                  type="button"
                  className="button button-dark button-block"
                  disabled={isSyncing}
                  onClick={handleSync}
                >
                  <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Memperbarui status…" : "Perbarui status"}
                </button>
                <button
                  type="button"
                  className="button button-danger button-block"
                  disabled={isCancelling}
                  onClick={handleCancel}
                >
                  {isCancelling ? "Membatalkan pesanan…" : "Batalkan pesanan"}
                </button>
              </>
            ) : (
              <Link
                href={`/orders/${encodeURIComponent(number)}`}
                className="button button-dark button-block"
              >
                Kembali ke pesanan
              </Link>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
