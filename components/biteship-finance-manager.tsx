"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { rupiah } from "@/lib/format";

type ManualType = "TOP_UP" | "DEDUCT_MANUAL";
type Entry = { id: string; type: string; amount: string; notes: string | null; actorId: string | null; createdAt: string };
type Account = { areaSearchCost: number; rateQuoteCost: number; trackingCheckCost: number };
type Draft = { type: ManualType; amount: string; notes: string };
const emptyDraft: Draft = { type: "TOP_UP", amount: "", notes: "" };
const automaticTypes = new Set(["USAGE_AREA", "USAGE_RATE", "USAGE_SHIPMENT", "USAGE_TRACKING", "REVERSAL"]);

async function readJson(response: Response) { const text = await response.text(); try { return text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { throw new Error("Respons server tidak valid"); } }

export function BiteshipFinanceManager({ entries, account }: { entries: Entry[]; account: Account }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [costs, setCosts] = useState({ areaSearchCost: String(account.areaSearchCost), rateQuoteCost: String(account.rateQuoteCost), trackingCheckCost: String(account.trackingCheckCost) });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function edit(entry: Entry) { const amount = BigInt(entry.amount); setEditingId(entry.id); setDraft({ type: entry.type as ManualType, amount: (amount < BigInt(0) ? -amount : amount).toString(), notes: entry.notes || "" }); setMessage(""); }
  async function saveEntry(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return;
    if (!/^[1-9]\d*$/.test(draft.amount)) return setMessage("Nominal catatan harus berupa bilangan bulat positif.");
    setBusy(true); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/admin/finance/biteship/${editingId}` : "/api/admin/finance/biteship", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await readJson(response); if (!response.ok) throw new Error(String(result.error || "Catatan dana belum dapat disimpan"));
      setDraft(null); setEditingId(null); setMessage("Catatan dana berhasil disimpan."); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Catatan dana belum dapat disimpan"); }
    finally { setBusy(false); }
  }
  async function remove(entry: Entry) {
    const amount = BigInt(entry.amount); const absoluteAmount = amount < BigInt(0) ? -amount : amount;
    if (!window.confirm(`Hapus catatan manual ${rupiah(absoluteAmount)}? Saldo akan dihitung ulang.`)) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/admin/finance/biteship/${entry.id}`, { method: "DELETE" }); const result = await readJson(response); if (!response.ok) throw new Error(String(result.error || "Catatan tidak dapat dihapus")); setMessage("Catatan dana berhasil dihapus."); router.refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Catatan tidak dapat dihapus"); }
    finally { setBusy(false); }
  }
  async function saveCosts(event: React.FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, Number(value)]));
    if (Object.values(payload).some(value => !Number.isSafeInteger(value) || value < 0)) return setMessage("Biaya layanan harus berupa bilangan bulat nol atau positif.");
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/finance/biteship/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await readJson(response); if (!response.ok) throw new Error(String(result.error || "Biaya layanan belum dapat disimpan")); setMessage("Biaya layanan berhasil disimpan."); router.refresh(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Biaya layanan belum dapat disimpan"); }
    finally { setBusy(false); }
  }

  return <>
    {message && <p className={`form-banner ${message.includes("berhasil") ? "success" : "error"}`} role="status">{message}</p>}
    <div className="finance-two-column">
      <section className="admin-panel finance-action-panel"><div className="admin-panel-head"><div><h2>Penyesuaian manual</h2><p>Tambah atau kurangi saldo bayangan dengan catatan yang dapat diaudit.</p></div><button className="button button-dark button-compact" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}><Plus size={15}/> Catat dana</button></div><div className="finance-panel-copy"><p>Catatan otomatis dari permintaan Biteship tidak dapat diedit atau dihapus. Koreksi dilakukan melalui catatan manual baru.</p></div></section>
      <section className="admin-panel finance-action-panel"><div className="admin-panel-head"><div><h2>Biaya per permintaan</h2><p>Nilai nol tetap memerlukan saldo positif, tetapi tidak mengurangi saldo.</p></div></div><form className="finance-form" onSubmit={saveCosts}><div className="field-grid finance-cost-grid">{([['areaSearchCost','Cek area / kode pos'],['rateQuoteCost','Cek ongkir'],['trackingCheckCost','Cek resi / sinkronisasi']] as const).map(([key,label]) => <div className="field" key={key}><label htmlFor={key}>{label}</label><input id={key} type="number" min="0" step="1" value={costs[key]} onChange={event => setCosts(current => ({ ...current, [key]: event.target.value }))}/></div>)}</div><div className="finance-form-foot"><span>Biaya pembuatan shipment mengikuti ongkir quote.</span><button className="button button-light" disabled={busy}><Save size={15}/> Simpan biaya</button></div></form></section>
    </div>
    <section className="table-card finance-ledger-table" aria-labelledby="biteship-ledger-title"><div className="admin-panel-head"><div><h2 id="biteship-ledger-title">Riwayat dana Biteship</h2><p>Nilai positif menambah saldo, nilai negatif mengurangi saldo.</p></div></div><div className="admin-table-wrap" role="region" aria-labelledby="biteship-ledger-title" tabIndex={0}><table className="admin-table"><thead><tr><th>Waktu</th><th>Jenis</th><th>Catatan</th><th>Nominal</th><th>Admin</th><th>Aksi</th></tr></thead><tbody>{entries.map(entry => { const manual = !automaticTypes.has(entry.type); const amount = BigInt(entry.amount); const absoluteAmount = amount < BigInt(0) ? -amount : amount; return <tr key={entry.id}><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(entry.createdAt))}</td><td><span className="finance-type">{labelType(entry.type)}</span></td><td className="admin-table-cell-wrap">{entry.notes || "—"}</td><td><strong className={amount >= BigInt(0) ? "finance-positive" : "finance-negative"}>{amount >= BigInt(0) ? "+" : "−"}{rupiah(absoluteAmount)}</strong></td><td>{entry.actorId || "system"}</td><td className="admin-table-action">{manual ? <div className="table-actions"><button className="icon-button" type="button" onClick={() => edit(entry)} disabled={busy} aria-label="Edit catatan"><Pencil size={15}/></button><button className="icon-button" type="button" onClick={() => remove(entry)} disabled={busy} aria-label="Hapus catatan"><Trash2 size={15}/></button></div> : <span className="sub">Otomatis</span>}</td></tr>})}{!entries.length && <tr><td colSpan={6} className="table-empty-state">Belum ada riwayat dana Biteship.</td></tr>}</tbody></table></div></section>
    {draft && <div className="profile-modal-overlay" role="presentation"><form className="profile-modal-card" onSubmit={saveEntry}><div className="profile-modal-head"><h2>{editingId ? "Edit catatan dana" : "Catat dana Biteship"}</h2><button className="icon-button" type="button" onClick={() => setDraft(null)} aria-label="Tutup"><X size={18}/></button></div><div className="profile-modal-body"><div className="field"><label htmlFor="fund-type">Jenis transaksi</label><select id="fund-type" value={draft.type} onChange={event => setDraft(current => current ? { ...current, type: event.target.value as ManualType } : current)}><option value="TOP_UP">Tambah dana</option><option value="DEDUCT_MANUAL">Kurangi dana</option></select></div><div className="field"><label htmlFor="fund-amount">Nominal</label><input id="fund-amount" type="number" min="1" step="1" required value={draft.amount} onChange={event => setDraft(current => current ? { ...current, amount: event.target.value } : current)}/></div><div className="field"><label htmlFor="fund-notes">Catatan</label><textarea id="fund-notes" minLength={3} maxLength={500} required value={draft.notes} onChange={event => setDraft(current => current ? { ...current, notes: event.target.value } : current)}/></div></div><div className="profile-modal-foot"><button className="button button-light" type="button" onClick={() => setDraft(null)}>Batal</button><button className="button button-dark" disabled={busy}><Save size={15}/>{busy ? "Menyimpan…" : "Simpan catatan"}</button></div></form></div>}
  </>;
}

function labelType(type: string) { return ({ TOP_UP: "Tambah dana", DEDUCT_MANUAL: "Kurangi manual", USAGE_AREA: "Cek area", USAGE_RATE: "Cek ongkir", USAGE_SHIPMENT: "Buat shipment", USAGE_TRACKING: "Cek resi", REVERSAL: "Pembalikan gagal" } as Record<string, string>)[type] || type; }
