"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { rupiah } from "@/lib/format";

type PublicVoucher = { code: string; name: string; description: string | null; mode: "NOMINAL" | "PERCENTAGE"; discountValue: number; minPurchase: number | null; maxDiscount: number | null; endAt: Date | null; target: string };

function label(voucher: PublicVoucher) {
  return voucher.mode === "PERCENTAGE" ? `Diskon ${voucher.discountValue}%` : `Potongan ${rupiah(voucher.discountValue)}`;
}

function expiryLabel(endAt: Date | null) {
  if (!endAt) return "Berlaku tanpa batas waktu";
  return `Berlaku sampai ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(endAt))}`;
}

export function PublicVoucherMarquee({ vouchers }: { vouchers: PublicVoucher[] }) {
  const [copied, setCopied] = useState("");
  if (!vouchers.length) return null;
  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(code); window.setTimeout(() => setCopied(current => current === code ? "" : current), 1800); }
    catch { setCopied(""); }
  }
  return (
    <section className="public-vouchers" aria-labelledby="public-vouchers-title">
      <div className="public-voucher-head"><div><p className="eyebrow">Promo pilihan</p><h2 id="public-vouchers-title">Kode promo untukmu</h2></div><p>Salin kode, lalu gunakan saat checkout.</p></div>
      <div className="public-voucher-grid" aria-label="Daftar promo publik">
        {vouchers.map(voucher => <article className="public-voucher-card" key={voucher.code}>
          <div className="public-voucher-card-top"><span className="public-voucher-tag">PROMO TOKO</span><span className="public-voucher-mode">{voucher.mode === "PERCENTAGE" ? "Persentase" : "Nominal"}</span></div>
          <div className="public-voucher-card-title"><strong>{label(voucher)}</strong><span>{voucher.name}</span></div>
          <p className="public-voucher-description">{voucher.description || (voucher.minPurchase ? `Minimum belanja ${rupiah(voucher.minPurchase)}` : "Berlaku tanpa minimum belanja")}</p>
          <p className="public-voucher-expiry">{expiryLabel(voucher.endAt)}</p>
          <div className="public-voucher-actions"><code>{voucher.code}</code><button type="button" className={copied === voucher.code ? "copied" : ""} onClick={() => copy(voucher.code)} aria-label={`Salin kode promo ${voucher.code}`}>{copied === voucher.code ? <><Check size={14}/> Tersalin</> : <><Copy size={14}/> Salin kode</>}</button></div>
        </article>)}
      </div>
    </section>
  );
}
