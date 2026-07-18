"use client";

import { useId, useState } from "react";
import { Save, X } from "lucide-react";

export function InventoryAdjustButton({ id, reserved }: { id: string; reserved: number }) {
  const disclosureId = useId();
  const deltaId = useId();
  const reasonId = useId();
  const helpId = useId();
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) return setError("Perubahan harus berupa angka bulat selain 0.");
    if (reason.trim().length < 3) return setError("Alasan minimal 3 karakter.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: value, reason }),
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

  return (
    <div className={`inventory-adjust-disclosure${open ? " open" : ""}`}>
      <button
        className="button button-quiet button-compact inventory-adjust-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={disclosureId}
        disabled={busy}
        onClick={() => {
          setOpen(current => !current);
          setError("");
        }}
      >
        {open ? "Tutup penyesuaian" : "Sesuaikan stok"}
      </button>
      {open && (
        <form
          id={disclosureId}
          className="inventory-adjust"
          aria-label="Formulir penyesuaian stok"
          aria-busy={busy}
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="inventory-adjust-field" htmlFor={deltaId}>
            <span>Perubahan</span>
            <input id={deltaId} type="number" inputMode="numeric" step="1" value={delta} onChange={event => setDelta(event.target.value)} placeholder="+10 / -2" aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`} aria-invalid={Boolean(error)}/>
          </label>
          <label className="inventory-adjust-field" htmlFor={reasonId}>
            <span>Alasan</span>
            <input id={reasonId} value={reason} minLength={3} maxLength={255} onChange={event => setReason(event.target.value)} placeholder="Contoh: stok opname" aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`} aria-invalid={Boolean(error)}/>
          </label>
          <div className="inventory-adjust-actions">
            <button type="submit" className="icon-button" disabled={busy} aria-label={busy ? "Menyimpan penyesuaian stok" : "Simpan penyesuaian stok"} title="Simpan penyesuaian">
              <Save size={14}/>
            </button>
            <button type="button" className="icon-button" disabled={busy} onClick={() => { setOpen(false); setError(""); }} aria-label="Tutup penyesuaian stok" title="Tutup">
              <X size={14}/>
            </button>
          </div>
          <small id={helpId}>{reserved > 0 ? `${reserved} unit sedang direservasi. ` : ""}Gunakan angka positif untuk menambah dan negatif untuk mengurangi stok.</small>
          {error && <small id={errorId} className="form-error" role="alert">{error}</small>}
        </form>
      )}
    </div>
  );
}
