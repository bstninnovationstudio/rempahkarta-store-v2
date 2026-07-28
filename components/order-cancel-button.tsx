"use client";

import { useState } from "react";
import Script from "next/script";
import { useTurnstile } from "@/components/use-turnstile";

const buyerReasons = [
  "Ingin mengubah alamat pengiriman",
  "Ingin mengubah varian produk",
  "Salah memasukkan jumlah barang",
  "Menemukan harga lebih murah di tempat lain",
  "Tidak ingin melanjutkan pemesanan",
  "Alasan lainnya"
];

export function OrderCancelButton({number,paymentState,turnstileSiteKey}:{number:string;paymentState:string;turnstileSiteKey:string}){
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState(buyerReasons[0]);
  const [customReason, setCustomReason] = useState("");
  const { containerRef, token } = useTurnstile(turnstileSiteKey);

  async function cancel() {
    const selectedReason = reason === "Alasan lainnya" ? customReason.trim() : reason;
    if (!selectedReason || selectedReason.length < 3) {
      alert("Silakan masukkan alasan pembatalan minimal 3 karakter.");
      return;
    }
    const confirmMessage = paymentState === "pending"
      ? "Apakah Anda yakin ingin membatalkan pesanan ini? Pembayaran belum selesai dan pesanan akan dibatalkan langsung."
      : "Ajukan pembatalan pesanan ini?";
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    setMessage("");
    try {
      const turnstileToken = await token("order_cancel");
      const response = await fetch(`/api/orders/${encodeURIComponent(number)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: selectedReason, turnstileToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pembatalan gagal");
      setMessage(data.status === "cancelled" ? "Pesanan berhasil dibatalkan." : "Permintaan pembatalan dikirim ke admin.");
      setTimeout(() => location.reload(), 700);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Pembatalan gagal");
    } finally {
      setBusy(false);
    }
  }

  if (!showConfirm) {
    return (
      <div>
        <button
          className="button button-danger"
          onClick={() => setShowConfirm(true)}
        >
          {paymentState === "pending" ? "Batalkan pesanan" : "Ajukan pembatalan"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={containerRef} aria-hidden="true" />
      <div className="action-review action-review-danger">
        <label className="field">
          <span>{paymentState === "pending" ? "Alasan pembatalan" : "Alasan pembatalan pelanggan"}</span>
          <select value={reason} onChange={e => setReason(e.target.value)}>
            {buyerReasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {reason === "Alasan lainnya" && (
          <input
            type="text"
            placeholder="Tulis alasan Anda…"
            value={customReason}
            onChange={e => setCustomReason(e.target.value)}
            className="action-input"
          />
        )}
        <div className="action-button-row">
          <button
            className="button button-danger-solid"
            disabled={busy}
            onClick={cancel}
          >
            {busy ? "Mengirim…" : paymentState === "pending" ? "Batalkan pesanan" : "Kirim pengajuan"}
          </button>
          <button
            className="button button-light"
            onClick={() => setShowConfirm(false)}
          >
            Kembali
          </button>
        </div>
      </div>
      {message && <p role="status" className={`action-message ${message.includes("berhasil") || message.includes("dikirim") ? "success" : "error"}`}>{message}</p>}
    </div>
  );
}
