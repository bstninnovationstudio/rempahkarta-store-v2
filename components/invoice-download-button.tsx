"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

type InvoiceDownloadButtonProps = {
  orderNumber: string;
};

export function InvoiceDownloadButton({ orderNumber }: InvoiceDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/invoice-pdf`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Gagal mengunduh invoice (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunduh invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="button button-light"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={15} className="spin-icon" aria-hidden="true" />
      ) : (
        <Download size={15} aria-hidden="true" />
      )}
      {loading ? "Mengunduh…" : "Unduh invoice"}
    </button>
  );
}
