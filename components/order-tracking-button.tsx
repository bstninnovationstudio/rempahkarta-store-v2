"use client";

import { useState } from "react";
import { Check, Copy, Truck } from "lucide-react";

export function OrderTrackingButton({
  courier,
  tracking,
  hasResi,
}: {
  courier: string;
  tracking: string;
  hasResi: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  async function handleClick() {
    if (hasResi && tracking && tracking !== "Menunggu resi") {
      try {
        await navigator.clipboard.writeText(tracking);
        setCopied(true);
        setToastMessage(`Nomor resi ${tracking} berhasil disalin!`);
        setTimeout(() => setCopied(false), 2500);
        setTimeout(() => setToastMessage(""), 3500);
      } catch {
        setToastMessage(`Nomor resi: ${tracking}`);
        setTimeout(() => setToastMessage(""), 3500);
      }
    } else {
      setToastMessage("Nomor resi belum tersedia. Penjual sedang menyiapkan paket pesanan Anda.");
      setTimeout(() => setToastMessage(""), 3500);
    }
  }

  return (
    <div className="order-tracking-container">
      <button
        type="button"
        className="button button-light order-tracking-btn"
        onClick={handleClick}
        title={hasResi ? "Klik untuk menyalin nomor resi" : "Menunggu resi dari kurir"}
      >
        {copied ? (
          <>
            <Check size={15} style={{ color: "var(--success)", flexShrink: 0 }} /> <span className="tracking-btn-text">Resi disalin!</span>
          </>
        ) : (
          <>
            {hasResi ? <Copy size={15} style={{ flexShrink: 0 }} /> : <Truck size={15} style={{ flexShrink: 0 }} />} <span className="tracking-btn-text">{courier} · {hasResi ? tracking : "Menunggu resi"}</span>
          </>
        )}
      </button>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`action-message ${hasResi ? "success" : "tone-warning"}`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
