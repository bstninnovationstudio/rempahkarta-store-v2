"use client";
import { useState } from "react";

export function PaymentSyncButton({ number, token }: { number: string; token: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(number)}/payment/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pemeriksaan gagal");
      setMessage(`Status pembayaran: ${data.status}`);
      setTimeout(() => location.reload(), 700);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Pemeriksaan gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="payment-sync-action">
      <button className="button button-light" onClick={sync} disabled={busy}>
        {busy ? "Memeriksa…" : "Periksa status pembayaran"}
      </button>
      {message && <p className="action-message" role="status">{message}</p>}
    </div>
  );
}
