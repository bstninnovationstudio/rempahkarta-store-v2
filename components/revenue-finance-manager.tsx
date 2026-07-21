"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote } from "lucide-react";
import { rupiah } from "@/lib/format";

async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) as Record<string, unknown> : {}; }
  catch { throw new Error("Respons server tidak valid"); }
}

export function RevenueFinanceManager({ availableBalance }: { availableBalance: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[1-9]\d*$/.test(amount)) {
      setMessage("Nominal harus lebih dari nol dan tidak boleh melebihi saldo tersedia.");
      return;
    }
    const requestedAmount = BigInt(amount);
    const available = BigInt(availableBalance);
    if (requestedAmount > available) {
      setMessage("Nominal harus lebih dari nol dan tidak boleh melebihi saldo tersedia.");
      return;
    }
    if (!window.confirm(`Catat penarikan dana sebesar ${rupiah(requestedAmount)}? Saldo tersedia akan berkurang.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/finance/omzet/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, notes: notes || undefined }) });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error || "Penarikan belum dapat dicatat"));
      setAmount(""); setNotes(""); setMessage("Penarikan berhasil dicatat."); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Penarikan belum dapat dicatat"); }
    finally { setBusy(false); }
  }

  return (
    <section className="admin-panel finance-action-panel" aria-labelledby="withdraw-title">
      <div className="admin-panel-head"><div><h2 id="withdraw-title">Catat penarikan dana</h2><p>Penarikan ini hanya pencatatan internal, tidak mengirim instruksi ke penyedia pembayaran.</p></div><Banknote size={18} aria-hidden="true" /></div>
      <form className="finance-form" onSubmit={submit}>
        {message && <p className={`form-banner ${message.includes("berhasil") ? "success" : "error"}`} role="status">{message}</p>}
        <div className="field-grid">
          <div className="field"><label htmlFor="withdraw-amount">Nominal penarikan</label><div className="finance-input-action"><input id="withdraw-amount" type="number" min="1" max={availableBalance} step="1" value={amount} onChange={event => setAmount(event.target.value)} required /><button className="button button-light button-compact" type="button" onClick={() => setAmount(availableBalance)} disabled={BigInt(availableBalance) <= BigInt(0)}>Tarik semua</button></div></div>
          <div className="field"><label htmlFor="withdraw-notes">Catatan <small>(opsional)</small></label><input id="withdraw-notes" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Contoh: Penarikan mingguan" /></div>
        </div>
        <div className="finance-form-foot"><span>Maksimal {rupiah(BigInt(availableBalance))}</span><button className="button button-dark" type="submit" disabled={busy || BigInt(availableBalance) <= BigInt(0)}>{busy ? "Mencatat…" : "Lakukan penarikan"}</button></div>
      </form>
    </section>
  );
}
