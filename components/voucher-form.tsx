"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";

export type VoucherDraft = {
  name: string; description: string | null; code: string; status: "ACTIVE" | "PAUSE" | "FINISH"; available: "public" | "private"; mode: "NOMINAL" | "PERCENTAGE"; discountValue: number; minPurchase: number | null; maxDiscount: number | null; dailyLimit: number | null; totalLimit: number | null; userLimit: number | null; startAt: string | null; endAt: string | null; target: "TOTAL" | "PRODUCT_SUBTOTAL" | "SHIPPING";
};

export const emptyVoucherDraft: VoucherDraft = { name: "", description: null, code: "", status: "ACTIVE", available: "public", mode: "NOMINAL", discountValue: 0, minPurchase: null, maxDiscount: null, dailyLimit: null, totalLimit: null, userLimit: null, startAt: null, endAt: null, target: "TOTAL" };
function localDate(value: string | null) { return value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 16) : ""; }
async function readJson(response: Response) { const text = await response.text(); try { return text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { return {}; } }

export function VoucherForm({ initial, voucherId }: { initial: VoucherDraft; voucherId?: string; usageCount?: number }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof VoucherDraft>(key: K, value: VoucherDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(voucherId ? `/api/admin/vouchers/${voucherId}` : "/api/admin/vouchers", { method: voucherId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error || "Voucher gagal disimpan"));
      window.location.href = "/admin/vouchers";
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Voucher gagal disimpan"); setBusy(false); }
  }
  return <div className="admin-content voucher-detail-page">
    <div className="admin-page-head"><div><Link href="/admin/vouchers" className="admin-back-link"><ArrowLeft size={15}/> Kembali ke voucher</Link><h1>{voucherId ? "Kelola voucher" : "Tambah voucher"}</h1><p>Atur identitas promo, aturan diskon, kuota, dan masa berlaku dalam satu alur yang jelas.</p></div></div>
    {error && <p className="form-banner error" role="alert">{error}</p>}
    <form className="voucher-detail-layout" onSubmit={submit}>
      <div className="voucher-detail-main">
        <section className="admin-form-section"><div className="admin-form-section-head"><div><p className="section-kicker">01 · Identitas</p><h2>Informasi promo</h2><p>Nama dan kode yang akan dikenali pelanggan.</p></div></div><div className="field-grid"><div className="field"><label htmlFor="voucher-name">Nama promo <small>*</small></label><input id="voucher-name" required maxLength={160} value={draft.name} onChange={e => update("name", e.target.value)} /></div><div className="field"><label htmlFor="voucher-code">Kode promo <small>*</small></label><input id="voucher-code" required pattern="[A-Z0-9_-]{3,50}" value={draft.code} onChange={e => update("code", e.target.value.toUpperCase())} /></div><div className="field full"><label htmlFor="voucher-description">Deskripsi</label><textarea id="voucher-description" maxLength={5000} rows={4} value={draft.description || ""} onChange={e => update("description", e.target.value || null)} placeholder="Jelaskan promo secara singkat." /></div></div></section>
        <section className="admin-form-section"><div className="admin-form-section-head"><div><p className="section-kicker">02 · Aturan</p><h2>Aturan diskon</h2><p>Nilai potongan dan bagian pesanan yang menjadi dasar perhitungan.</p></div></div><div className="field-grid"><Select label="Status" value={draft.status} onChange={v => update("status", v as VoucherDraft["status"])} options={[["ACTIVE", "ACTIVE · Bisa digunakan"], ["PAUSE", "PAUSE · Dijeda"], ["FINISH", "FINISH · Selesai"]]} /><Select label="Available" value={draft.available} onChange={v => update("available", v as VoucherDraft["available"])} options={[["public", "Public · Tampil di toko"], ["private", "Private · Tidak ditampilkan"]]} /><Select label="Mode promo" value={draft.mode} onChange={v => update("mode", v as VoucherDraft["mode"])} options={[["NOMINAL", "Nominal"], ["PERCENTAGE", "Persentase"]]} /><NumberField label={draft.mode === "PERCENTAGE" ? "Nilai diskon (%)" : "Nilai diskon (Rp)"} value={draft.discountValue} onChange={v => update("discountValue", v || 0)} required /><Select label="Berlaku untuk" value={draft.target} onChange={v => update("target", v as VoucherDraft["target"])} options={[["TOTAL", "Total invoice"], ["PRODUCT_SUBTOTAL", "Subtotal produk"], ["SHIPPING", "Biaya ongkir"]]} /></div></section>
        <section className="admin-form-section"><div className="admin-form-section-head"><div><p className="section-kicker">03 · Batasan</p><h2>Minimum dan kuota</h2><p>Kosongkan batas yang tidak ingin diterapkan.</p></div></div><div className="field-grid"><NumberField label="Minimum nominal dasar" value={draft.minPurchase} onChange={v => update("minPurchase", v)} /><NumberField label="Maksimal diskon" value={draft.maxDiscount} onChange={v => update("maxDiscount", v)} /><NumberField label="Limit harian total" value={draft.dailyLimit} onChange={v => update("dailyLimit", v)} /><NumberField label="Limit total keseluruhan" value={draft.totalLimit} onChange={v => update("totalLimit", v)} /><NumberField label="Limit per user" value={draft.userLimit} onChange={v => update("userLimit", v)} /></div></section>
        <section className="admin-form-section"><div className="admin-form-section-head"><div><p className="section-kicker">04 · Jadwal</p><h2>Masa berlaku (WIB)</h2><p>Kosongkan tanggal untuk membuat promo tanpa batas waktu.</p></div></div><div className="field-grid"><div className="field"><label htmlFor="voucher-start">Mulai berlaku (WIB)</label><input id="voucher-start" type="datetime-local" value={localDate(draft.startAt)} onChange={e => update("startAt", e.target.value || null)} /></div><div className="field"><label htmlFor="voucher-end">Berakhir (WIB)</label><input id="voucher-end" type="datetime-local" value={localDate(draft.endAt)} onChange={e => update("endAt", e.target.value || null)} /></div></div></section>
        <footer className="form-footer-actions voucher-detail-actions"><Link className="button button-light" href="/admin/vouchers">Batal</Link><button className="button button-dark" type="submit" disabled={busy}><Save size={15}/>{busy ? "Menyimpan…" : "Simpan voucher"}</button></footer>
      </div>
    </form>
  </div>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <div className="field"><label>{label}</label><select value={value} onChange={e => onChange(e.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>; }
function NumberField({ label, value, onChange, required = false }: { label: string; value: number | null; onChange: (value: number | null) => void; required?: boolean }) { return <div className="field"><label>{label} <small>{required ? "*" : "(opsional)"}</small></label><input type="number" min="1" step="1" required={required} value={value ?? ""} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} /></div>; }
