"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function AdminOrderDuplicateButton({ number }: { number: string }) {
  const [busy, setBusy] = useState(false);

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Duplikasi pesanan ${number} sebagai pesanan baru dengan status setelah bayar?`)) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(number)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menduplikasi pesanan.");

      alert(`Pesanan berhasil diduplikasi ke: ${data.order_number}`);
      location.href = `/admin/orders/${data.order_number}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menduplikasi pesanan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={busy}
      aria-busy={busy}
      aria-label={busy ? `Sedang menduplikasi pesanan ${number}` : `Duplikasi pesanan ${number}`}
      title="Duplikasi pesanan (mock)"
      className="button button-quiet button-compact duplicate-order-button"
    >
      <Copy size={13} />
      {busy ? "Menduplikasi…" : "Duplikat"}
    </button>
  );
}
