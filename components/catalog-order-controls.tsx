"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

export function CatalogOrderControls({ endpoint, label, isFirst, isLast }: { endpoint: string; label: string; isFirst: boolean; isLast: boolean }) {
  const [busy, setBusy] = useState(false);
  async function move(direction: "up" | "down") {
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Urutan gagal diperbarui");
      window.location.reload();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Urutan gagal diperbarui");
      setBusy(false);
    }
  }
  return <div className="catalog-order-controls" aria-label={`Atur urutan ${label}`}>
    <button className="icon-button" type="button" onClick={() => move("up")} disabled={busy || isFirst} aria-label={`Naikkan urutan ${label}`} title="Naikkan"><ArrowUp size={15}/></button>
    <button className="icon-button" type="button" onClick={() => move("down")} disabled={busy || isLast} aria-label={`Turunkan urutan ${label}`} title="Turunkan"><ArrowDown size={15}/></button>
  </div>;
}
