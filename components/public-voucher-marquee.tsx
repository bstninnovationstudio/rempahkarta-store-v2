"use client";

import { Copy, Check, Info, X } from "lucide-react";
import { useState } from "react";
import { rupiah } from "@/lib/format";

type PublicVoucher = {
  code: string;
  name: string;
  description: string | null;
  mode: "NOMINAL" | "PERCENTAGE";
  discountValue: number;
  minPurchase: number | null;
  maxDiscount: number | null;
  endAt: Date | null;
  target: string;
};

function label(voucher: PublicVoucher) {
  return voucher.mode === "PERCENTAGE" ? `Diskon ${voucher.discountValue}%` : `Potongan ${rupiah(voucher.discountValue)}`;
}

function expiryLabel(endAt: Date | null) {
  if (!endAt) return "Berlaku tanpa batas waktu";
  return `Berlaku sampai ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(endAt))}`;
}

export function PublicVoucherMarquee({ vouchers }: { vouchers: PublicVoucher[] }) {
  const [copied, setCopied] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<PublicVoucher | null>(null);

  if (!vouchers.length) return null;

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(current => (current === code ? "" : current)), 1800);
    } catch {
      setCopied("");
    }
  }

  return (
    <>
      <section className="public-vouchers" aria-labelledby="public-vouchers-title">
        <div className="public-voucher-head">
          <div>
            <p className="eyebrow">Promo pilihan</p>
            <h2 id="public-vouchers-title">Kode promo untukmu</h2>
          </div>
          <p>Salin kode, lalu gunakan saat checkout.</p>
        </div>
        <div className="public-voucher-grid" aria-label="Daftar promo publik">
          {vouchers.map(voucher => (
            <article className="public-voucher-card" key={voucher.code}>
              <div className="public-voucher-card-top">
                <span className="public-voucher-tag">PROMO TOKO</span>
                <span className="public-voucher-mode">{voucher.mode === "PERCENTAGE" ? "Persentase" : "Nominal"}</span>
              </div>
              <div className="public-voucher-card-title">
                <strong title={label(voucher)}>{label(voucher)}</strong>
                <span title={voucher.name}>{voucher.name}</span>
              </div>
              <p className="public-voucher-description" title={voucher.description || undefined}>
                {voucher.description || (voucher.minPurchase ? `Minimum belanja ${rupiah(voucher.minPurchase)}` : "Berlaku tanpa minimum belanja")}
              </p>
              <p className="public-voucher-expiry" title={expiryLabel(voucher.endAt)}>{expiryLabel(voucher.endAt)}</p>
              <div className="public-voucher-actions">
                <code title={voucher.code}>{voucher.code}</code>
                <div className="public-voucher-buttons">
                  <button type="button" onClick={() => setSelectedVoucher(voucher)} aria-label={`Buka info promo ${voucher.code}`}>
                    <Info size={14} /> Buka Info
                  </button>
                  <button
                    type="button"
                    className={copied === voucher.code ? "copied" : ""}
                    onClick={() => copy(voucher.code)}
                    aria-label={`Salin kode promo ${voucher.code}`}
                  >
                    {copied === voucher.code ? (
                      <>
                        <Check size={14} /> Tersalin
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Salin Kode
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedVoucher && (
        <div className="profile-modal-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) setSelectedVoucher(null); }}>
          <section className="profile-modal-card public-voucher-modal" role="dialog" aria-modal="true" aria-labelledby="voucher-modal-title">
            <header className="profile-modal-head">
              <div>
                <span className="public-voucher-tag">PROMO TOKO</span>
                <h2 id="voucher-modal-title" style={{ marginTop: 2 }}>Detail Promo</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedVoucher(null)} aria-label="Tutup detail promo">
                <X size={18} />
              </button>
            </header>
            <div className="profile-modal-body">
              <div className="voucher-modal-hero">
                <strong className="voucher-modal-amount">{label(selectedVoucher)}</strong>
                <p className="voucher-modal-name">{selectedVoucher.name}</p>
              </div>

              <div className="voucher-modal-code-box">
                <div className="voucher-modal-code-label">Kode Promo</div>
                <div className="voucher-modal-code-row">
                  <code>{selectedVoucher.code}</code>
                  <button
                    type="button"
                    className={`button button-light ${copied === selectedVoucher.code ? "copied" : ""}`}
                    onClick={() => copy(selectedVoucher.code)}
                  >
                    {copied === selectedVoucher.code ? <><Check size={14} /> Tersalin</> : <><Copy size={14} /> Salin Kode</>}
                  </button>
                </div>
              </div>

              <div className="voucher-modal-details-grid">
                <div className="voucher-modal-detail-item">
                  <span className="label">Target Diskon</span>
                  <span className="value">
                    {selectedVoucher.target === "SHIPPING" ? "Ongkos Kirim" : selectedVoucher.target === "PRODUCT_SUBTOTAL" ? "Subtotal Produk" : "Total (Produk & Ongkir)"}
                  </span>
                </div>
                <div className="voucher-modal-detail-item">
                  <span className="label">Minimal Belanja</span>
                  <span className="value">
                    {selectedVoucher.minPurchase ? rupiah(selectedVoucher.minPurchase) : "Tanpa Minimum Belanja"}
                  </span>
                </div>
                {selectedVoucher.maxDiscount ? (
                  <div className="voucher-modal-detail-item">
                    <span className="label">Maksimal Diskon</span>
                    <span className="value">{rupiah(selectedVoucher.maxDiscount)}</span>
                  </div>
                ) : null}
                <div className="voucher-modal-detail-item">
                  <span className="label">Masa Berlaku</span>
                  <span className="value">{expiryLabel(selectedVoucher.endAt)}</span>
                </div>
              </div>

              {selectedVoucher.description && (
                <div className="voucher-modal-description-box">
                  <span className="label">Syarat & Ketentuan</span>
                  <p>{selectedVoucher.description}</p>
                </div>
              )}
            </div>
            <footer className="profile-modal-foot">
              <button type="button" className="button button-light" onClick={() => setSelectedVoucher(null)}>
                Tutup
              </button>
              <button
                type="button"
                className="button button-dark"
                onClick={() => copy(selectedVoucher.code)}
              >
                {copied === selectedVoucher.code ? <><Check size={15} /> Tersalin</> : <><Copy size={15} /> Salin Kode</>}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
