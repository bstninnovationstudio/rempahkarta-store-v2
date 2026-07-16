"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";

export function InventoryAdjustButton({ id, reserved }: { id: string; reserved: number }) {
  const [open, setOpen] = useState(false); const [delta, setDelta] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit() {
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) return setError("Perubahan harus berupa angka bulat selain 0.");
    if (reason.trim().length < 3) return setError("Alasan minimal 3 karakter.");
    setBusy(true); setError("");
    try { const response = await fetch(`/api/admin/inventory/${id}/adjust`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta: value, reason }) }); const text = await response.text(); const result = text ? JSON.parse(text) as Record<string, unknown> : {}; if (!response.ok) throw new Error(String(result.error || "Penyesuaian gagal")); location.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Penyesuaian gagal"); setBusy(false); }
  }
  if (!open) return <button className="table-link as-button" type="button" onClick={() => setOpen(true)}>Adjust →</button>;
  return <div className="inventory-adjust"><input type="number" step="1" value={delta} onChange={event => setDelta(event.target.value)} placeholder="+10 / -2" aria-label="Perubahan stok"/><input value={reason} minLength={3} maxLength={255} onChange={event => setReason(event.target.value)} placeholder="Alasan" aria-label="Alasan penyesuaian"/><div><button type="button" className="icon-button" disabled={busy} onClick={submit} aria-label="Simpan"><Save size={14}/></button><button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Tutup"><X size={14}/></button></div>{reserved>0&&<small>{reserved} unit sedang direservasi</small>}{error&&<small className="form-error">{error}</small>}</div>;
}
