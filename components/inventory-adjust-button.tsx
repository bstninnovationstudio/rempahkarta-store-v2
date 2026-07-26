"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Save, X } from "lucide-react";

type Props = {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
};

export function InventoryAdjustButton({ id, sku, name, onHand, reserved }: Props) {
  const deltaId = useId();
  const reasonId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setOpen(false);
        setError("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy]);

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
    setDelta("");
    setReason("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) return setError("Perubahan harus berupa angka bulat selain 0.");
    if (value < 0 && onHand + value < reserved) return setError(`Stok tidak boleh kurang dari ${reserved} unit yang sedang direservasi.`);
    if (reason.trim().length < 3) return setError("Alasan minimal 3 karakter.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: value, reason: reason.trim() }),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) as Record<string, unknown> : {};
      if (!response.ok) throw new Error(String(result.error || "Penyesuaian gagal"));
      location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Penyesuaian gagal");
      setBusy(false);
    }
  }

  const next = Number(delta);
  const preview = Number.isInteger(next) && next !== 0 ? onHand + next : onHand;
  return <>
    <button className="button button-quiet button-compact inventory-adjust-trigger" type="button" onClick={() => setOpen(true)}>
      Sesuaikan stok
    </button>
    {open && <div className="inventory-adjust-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="inventory-adjust-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-adjust-title`} ref={dialogRef}>
        <header className="inventory-adjust-modal-head">
          <div><p className="eyebrow">Mutasi manual</p><h2 id={`${id}-adjust-title`}>Sesuaikan stok</h2><p>{sku} · {name}</p></div>
          <button className="icon-button" type="button" onClick={close} disabled={busy} aria-label="Tutup penyesuaian"><X size={18}/></button>
        </header>
        <form className="inventory-adjust-modal-body" onSubmit={submit} aria-busy={busy}>
          <div className="inventory-adjust-summary" aria-label="Ringkasan stok saat ini">
            <div><span>Stok fisik</span><strong>{onHand}</strong></div>
            <div><span>Direservasi</span><strong>{reserved}</strong></div>
            <div><span>Setelah perubahan</span><strong>{preview}</strong></div>
          </div>
          <p className="inventory-adjust-explainer"><strong>Tambah</strong> dengan angka positif, atau <strong>kurangi</strong> dengan angka negatif. Stok fisik tidak dapat turun di bawah jumlah yang sedang direservasi.</p>
          <label className="inventory-adjust-field" htmlFor={deltaId}><span>Perubahan stok <small>(wajib)</small></span><input id={deltaId} name="delta" type="number" inputMode="numeric" step="1" value={delta} onChange={event => setDelta(event.target.value)} placeholder="+10 atau -2" autoFocus aria-invalid={Boolean(error)} /></label>
          <label className="inventory-adjust-field" htmlFor={reasonId}><span>Alasan penyesuaian <small>(wajib)</small></span><input id={reasonId} name="reason" value={reason} minLength={3} maxLength={255} onChange={event => setReason(event.target.value)} placeholder="Contoh: hasil stok opname" aria-invalid={Boolean(error)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="inventory-adjust-modal-foot"><button className="button button-light" type="button" onClick={close} disabled={busy}>Batal</button><button className="button button-dark" type="submit" disabled={busy}><Save size={15}/>{busy ? "Menyimpan…" : "Simpan penyesuaian"}</button></footer>
        </form>
      </section>
    </div>}
  </>;
}
