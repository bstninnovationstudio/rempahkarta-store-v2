import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="footer-grid">
        <div className="footer-brand-column">
          <div className="footer-brand">
            <Image src="/main-logo.webp" alt="" width={42} height={42} />
            <div>
              <div className="wordmark footer-logo">REMPAHKARTA</div>
              <span>Hangatkan Keluarga Indonesia!</span>
            </div>
          </div>
          <p>
            Menghadirkan sukacita dan damai sejahtera dalam kehangatan untuk keluarga Anda. Mari temukan bersama REMPAHKARTA.
          </p>
        </div>
        <nav aria-label="Navigasi belanja">
          <h3>Belanja</h3>
          <Link href="/#product">Produk</Link>
          <Link href="/#values">Nilai utama</Link>
          <Link href="/#guarantee">Garansi</Link>
        </nav>
        <nav aria-label="Navigasi bantuan">
          <h3>Bantuan</h3>
          <Link href="/login">Masuk akun</Link>
          <Link href="/pages/terms">Syarat &amp; ketentuan</Link>
          <Link href="/pages/privacy">Kebijakan privasi</Link>
        </nav>
        <div className="footer-contact">
          <h3>Terhubung</h3>
          <a href="https://wa.me/62562524627" target="_blank" rel="noopener noreferrer">
            WhatsApp <ArrowUpRight size={14} />
          </a>
          <Link href="/#legal">Legalitas <ArrowUpRight size={14} /></Link>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 REMPAHKARTA. Seluruh hak cipta dilindungi.</span>
        <span>Pembayaran aman via QRIS · Pengiriman terintegrasi</span>
      </div>
    </footer>
  );
}
