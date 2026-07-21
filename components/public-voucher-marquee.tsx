"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { rupiah } from "@/lib/format";

type PublicVoucher = { code: string; name: string; description: string | null; mode: "NOMINAL" | "PERCENTAGE"; discountValue: number; minPurchase: number | null; maxDiscount: number | null; endAt: Date | null; target: string };

function label(voucher: PublicVoucher) {
  return voucher.mode === "PERCENTAGE" ? `Diskon ${voucher.discountValue}%` : `Potongan ${rupiah(voucher.discountValue)}`;
}

export function PublicVoucherMarquee({ vouchers }: { vouchers: PublicVoucher[] }) {
  const [copied, setCopied] = useState("");
  if (!vouchers.length) return null;
  const cards = [...vouchers, ...vouchers];
  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(code); window.setTimeout(() => setCopied(current => current === code ? "" : current), 1800); }
    catch { setCopied(""); }
  }
  return (
    <section className="public-vouchers" aria-labelledby="public-vouchers-title">
      <div className="public-voucher-head"><div><p className="eyebrow">Promo pilihan</p><h2 id="public-vouchers-title">Kode promo untukmu</h2></div><p>Salin kode, lalu pakai saat checkout.</p></div>
      <div className="voucher-marquee" aria-label="Daftar promo publik">
        <div className="voucher-marquee-track">
          {cards.map((voucher, index) => <article className="public-voucher-card" key={`${voucher.code}-${index}`} aria-hidden={index >= vouchers.length ? true : undefined}>
            <div><strong>{label(voucher)}</strong><span>{voucher.name}</span></div>
            <p>{voucher.description || (voucher.minPurchase ? `Min. belanja ${rupiah(voucher.minPurchase)}` : "Berlaku tanpa minimum belanja")}</p>
            <div className="public-voucher-actions"><code>{voucher.code}</code><button type="button" onClick={() => copy(voucher.code)} aria-label={`Salin kode ${voucher.code}`}>{copied === voucher.code ? <><Check size={14}/> Tersalin</> : <><Copy size={14}/> Salin</>}</button></div>
          </article>)}
        </div>
      </div>
    </section>
  );
}
