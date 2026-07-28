import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  ExternalLink,
  Leaf,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { ProductCatalog } from "@/components/product-catalog";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { getCatalogCategoryNames, getCatalogProducts } from "@/lib/catalog";
import { getPublicVouchers } from "@/lib/voucher";
import { PublicVoucherMarquee } from "@/components/public-voucher-marquee";

export const dynamic = "force-dynamic";

const values = [
  {
    icon: Leaf,
    title: "100% rempah asli",
    description: "Dipilih langsung dari petani lokal di berbagai wilayah Indonesia.",
  },
  {
    icon: Sparkles,
    title: "Bersih & higienis",
    description: "Diproses dengan standar kebersihan yang menjaga mutu setiap rempah.",
  },
  {
    icon: Clock,
    title: "Lebih tahan lama",
    description: "Dikeringkan dengan oven selama 6 jam untuk membantu proses sterilisasi.",
  },
  {
    icon: ShieldCheck,
    title: "Produk bergaransi",
    description: "Produk rusak atau tidak layak akan kami bantu ganti dengan produk baru.",
  },
] as const;

const certifications = [
  {
    label: "Sertifikat merek",
    value: "IDM001277950",
    description: "Merek terdaftar resmi di DJKI sebagai jaminan keaslian brand.",
    href: "https://pdki-indonesia.dgip.go.id/",
  },
  {
    label: "Sertifikat halal",
    value: "ID34410037665001225",
    description: "Sertifikasi halal untuk memberi ketenangan dalam setiap sajian.",
    href: "https://bpjph.halal.go.id/cari/sertifikat?no_regis=ID34410037665001225",
  },
  {
    label: "Izin edar P-IRT",
    value: "2103401061372-30",
    description: "Produk telah memenuhi ketentuan keamanan pangan industri rumah tangga.",
    href: "https://sppirt.pom.go.id/cek-sppirt",
  },
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const [products, categories, query, vouchers] = await Promise.all([getCatalogProducts(), getCatalogCategoryNames(), searchParams, getPublicVouchers()]);

  return (
    <>
      <StoreHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="mall-badges">
              <Image src="/shopee-mall.webp" alt="Shopee Mall" width={87} height={26} className="mall-badge" />
              <Image src="/tiktok-mall.webp" alt="TikTok Mall" width={87} height={26} className="mall-badge" />
            </div>
            <p className="eyebrow">100% Rempah Asli Nusantara</p>
            <h1>
              Bagikan Kehangatan<br />
              <em>untuk Keluarga!</em>
            </h1>
            <p>
              REMPAHKARTA adalah platform toko online resmi wedang uwuh khas Nusantara. Masuk dengan akun Google untuk mengelola profil, menyimpan alamat pengiriman, dan memantau status pesanan secara praktis dan aman.
            </p>
            <Link className="button button-dark" href="#product">
              Jelajahi produk <ArrowRight size={18} />
            </Link>
          </div>
          <div
            className="hero-image hero-image-main"
            style={{ backgroundImage: "url('/demo/banner.webp')" }}
          />
        </section>

        <section className="trust-strip" aria-label="Keunggulan toko">
          <div>
            <ShieldCheck />
            <span className="trust-text-desktop">100% Produk Asli</span>
            <span className="trust-text-mobile">100% Asli</span>
          </div>
          <div>
            <Truck />
            <span className="trust-text-desktop">Pengiriman otomatis</span>
            <span className="trust-text-mobile">Otomatis</span>
          </div>
          <div>
            <RotateCcw />
            <span className="trust-text-desktop">Jaminan Pengembalian</span>
            <span className="trust-text-mobile">Garansi</span>
          </div>
        </section>

        <section className="catalog-section" id="product">
          <div className="landing-section-head">
            <div>
              <p className="eyebrow">Produk Terbaik</p>
              <h2>Katalog Produk</h2>
            </div>
            <p>
              Untuk semua kalangan dan untuk kesehatan semua orang! Dapatkan dalam harga terbaik langsung dari produsennya!
            </p>
          </div>
          <ProductCatalog products={products} categoryNames={categories} autoFocusSearch={query.search === "1"} />
        </section>
        <PublicVoucherMarquee vouchers={vouchers} />

        <section className="values-section" id="values">
          <div className="landing-section-head">
            <div>
              <p className="eyebrow">Dari sumber hingga dapur</p>
              <h2>Mutu yang terasa<br />di setiap sajian.</h2>
            </div>
            <p>
              Kami menjaga rempah tetap autentik melalui pemilihan sumber, proses yang bersih,
              dan perlindungan produk yang jelas.
            </p>
          </div>
          <div className="values-grid">
            {values.map(({ icon: Icon, title, description }, index) => (
              <article className="value-card" key={title}>
                <span className="value-number">0{index + 1}</span>
                <div className="value-icon"><Icon size={22} aria-hidden="true" /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="editorial" id="guarantee">
          <div className="editorial-copy">
            <p className="eyebrow">Komitmen kami</p>
            <h2>Tenang dalam setiap pilihan.</h2>
            <p>
              Kartarians Guarantee™ adalah komitmen kami untuk menjaga kualitas. Jika produk yang
              Anda terima tidak sesuai standar kelayakan, kami siap membantu proses penggantiannya.
            </p>
            <Link href="/pages/returns">
              Pelajari kebijakan garansi <ArrowRight size={16} />
            </Link>
          </div>
          <div className="editorial-media">
            <div
              className="editorial-image"
              role="img"
              aria-label="Ilustrasi jaminan kualitas Kartarians Guarantee"
              style={{ backgroundImage: "url('/demo/garansi.webp')" }}
            />
            <div className="editorial-stamp" aria-hidden="true">
              <ShieldCheck size={19} />
              <span>Kartarians<br />Guarantee™</span>
            </div>
          </div>
        </section>

        <section className="legal-section" id="legal">
          <div className="legal-intro">
            <div>
              <p className="eyebrow"><BadgeCheck size={14} /> Legalitas terverifikasi</p>
              <h2>Kepercayaan yang<br />dapat Anda periksa.</h2>
            </div>
            <p>
              Setiap informasi legalitas kami tampilkan secara terbuka. Klik sertifikat untuk
              memeriksa data melalui situs resmi lembaga penerbit.
            </p>
          </div>
          <div className="legal-grid">
            {certifications.map(({ label, value, description, href }, index) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="legal-card"
                key={label}
                aria-label={`${label} ${value}, buka situs verifikasi`}
              >
                <div className="legal-card-top">
                  <span>0{index + 1}</span>
                  <ExternalLink size={17} aria-hidden="true" />
                </div>
                <h3>{label}</h3>
                <div className="legal-value">{value}</div>
                <p>{description}</p>
                <span className="legal-link-label">Periksa sertifikat <ArrowRight size={14} /></span>
              </a>
            ))}
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-copy">
            <p className="eyebrow">Kami siap membantu</p>
            <h2>Ada yang ingin<br />Anda tanyakan?</h2>
            <p>
              Bicarakan kebutuhan produk, pemesanan grosir, atau peluang kemitraan bersama tim
              REMPAHKARTA melalui WhatsApp.
            </p>
            <div className="contact-actions">
              <a
                href="https://wa.me/62562524627"
                target="_blank"
                rel="noopener noreferrer"
                className="button contact-button"
              >
                <MessageCircle size={18} /> Mulai percakapan <ArrowRight size={17} />
              </a>
              <span>Senin–Sabtu · 09.00–17.00 WIB</span>
            </div>
          </div>
          <div className="contact-media">
            <div
              className="contact-image"
              role="img"
              aria-label="Kontak WhatsApp REMPAHKARTA"
              style={{ backgroundImage: "url('/demo/contact.png')" }}
            />
          </div>
        </section>
      </main>
      <StoreFooter />
    </>
  );
}
