import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan privasi",
  description: "Kebijakan privasi dan perlindungan data pribadi pengguna REMPAHKARTA, pengolahan data Google OAuth, serta pembagian data dengan mitra pihak ketiga.",
  alternates: { canonical: "/pages/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <StoreHeader />
      <main className="simple-page policy-page">
        <div className="page-title">
          <p className="eyebrow">Legalitas &amp; Ketentuan</p>
          <h1>Kebijakan privasi</h1>
        </div>

        <article className="policy-panel">
          {/* BAB I */}
          <section>
            <h2>BAB I: KETENTUAN UMUM DAN KOMITMEN PRIVASI</h2>
            <h3>Pasal 1 (Prinsip Perlindungan Data)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  REMPAHKARTA sebagai brand penyedia produk rempah-rempah dan bahan makanan berkomitmen penuh untuk melindungi privasi, kerahasiaan, dan keamanan data pribadi seluruh Pengguna yang mengakses dan bertransaksi pada Platform resmi penjualan ini.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Kebijakan Privasi ini mengatur landasan perolehan, pengumpulan, pengolahan, penganalisisan, penyimpanan, pembagian, dan penghapusan data pribadi Pengguna sesuai dengan Undang-Undang No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP) dan peraturan perundang-undangan terkait di Indonesia.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB II */}
          <section>
            <h2>BAB II: PEROLEHAN DAN PENGUMPULAN DATA PRIBADI</h2>
            <h3>Pasal 2 (Jenis Data yang Dikumpulkan)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  <strong>Data Autentikasi Google (Single Sign-On):</strong> Saat Pengguna melakukan pendaftaran atau masuk akun (<em>login</em>), Platform mengumpulkan informasi profil dasar yang diberikan secara sah oleh Google mencakup alamat email terverifikasi, nama lengkap, serta foto profil publik melalui verifikasi server-side ID Token. REMPAHKARTA <strong>tidak pernah meminta, mengumpulkan, atau menyimpan kata sandi (<em>password</em>) akun Google Pengguna</strong>.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  <strong>Data Profil dan Kontak:</strong> Data yang diisi oleh Pengguna untuk melengkapi identitas akun, meliputi nomor telepon (WhatsApp), daftar alamat pengiriman lengkap beserta kode pos dan titik area lokasi.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  <strong>Data Rekening Pengembalian Dana:</strong> Informasi bank (nama bank, nomor rekening, dan nama pemilik rekening) yang diberikan Pengguna untuk keperluan pencairan pengembalian dana (<em>refund</em>).
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  <strong>Data Transaksi dan Riwayat:</strong> Rincian item pesanan produk rempah, nilai transaksi, riwayat pembayaran, data resi pengiriman, dokumen bukti pengajuan klaim, serta catatan komunikasi layanan.
                </div>
              </li>
              <li>
                <span className="ayat-num">(5)</span>
                <div>
                  <strong>Data Sesi dan Cookie:</strong> Penggunaan cookie penjelajahan terenkripsi yang aman (<em>HttpOnly, SameSite, Secure</em>) untuk mempertahankan sesi masuk Pengguna dan keamanan transaksi tanpa melacak aktivitas di luar Platform REMPAHKARTA.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB III */}
          <section>
            <h2>BAB III: PENGGUNAAN DAN PENGOLAHAN DATA PRIBADI</h2>
            <h3>Pasal 3 (Tujuan Pengolahan Data)</h3>
            <p>
              REMPAHKARTA menggunakan data pribadi Pengguna semata-mata untuk tujuan operasional dan peningkatan kualitas layanan penjualan produk rempah dan bahan makanan, meliputi:
            </p>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Memproses transaksi pemesanan produk, verifikasi pembayaran, dan verifikasi identitas akun Pengguna.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Mengatur pengemasan dan pengiriman paket rempah ke alamat tujuan Pengguna.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  Mengirimkan notifikasi status transaksi, bukti pembayaran, dan kode verifikasi (<em>OTP</em>) melalui pesan WhatsApp atas persetujuan (<em>consent</em>) Pengguna.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  Mengelola pengajuan permohonan kompensasi atau pengembalian dana (<em>refund</em>).
                </div>
              </li>
              <li>
                <span className="ayat-num">(5)</span>
                <div>
                  Memenuhi kewajiban pelaporan hukum, audit operasional, dan pencegahan tindakan kecurangan (<em>fraud</em>).
                </div>
              </li>
            </ul>
          </section>

          {/* BAB IV */}
          <section>
            <h2>BAB IV: PEMBAGIAN DATA DENGAN MITRA PIHAK KETIGA</h2>
            <h3>Pasal 4 (Kemitraan dan Kerjasama Pihak Ketiga)</h3>
            <p>
              REMPAHKARTA tidak pernah menjual, menyewakan, atau memperdagangkan data pribadi Pengguna kepada pihak manapun. Pembagian data terbatas hanya dilakukan kepada mitra resmi untuk mendukung keterlaksanaan transaksi Pengguna:
            </p>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  <strong>Mitra Logistik (Biteship):</strong> Nama penerima, nomor telepon, alamat pengiriman, serta berat/dimensi paket dibagikan kepada Biteship dan kurir ekspedisi terkait untuk pelaksanaan pengiriman paket rempah dan pembaruan pelacakan resi.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  <strong>Mitra Pembayaran (BSTN):</strong> Identitas transaksi dan nominal tagihan diteruskan ke pihak penyedia <em>payment gateway</em> BSTN untuk pembentukan kode pembayaran QRIS secara terenkripsi.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  <strong>Layanan Komunikasi (WhatsApp):</strong> Nomor telepon Pengguna digunakan untuk transmisi pesan WhatsApp otomatis (seperti kode OTP dan notifikasi perjalanan pesanan) secara aman berdasarkan pilihan persetujuan Pengguna.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  <strong>Kewajiban Hukum:</strong> REMPAHKARTA dapat mengungkapkan data Pengguna apabila diwajibkan oleh perintah pengadilan, kepolisian, atau instansi pemerintah yang berwenang sesuai ketentuan hukum.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB V */}
          <section>
            <h2>BAB V: KEAMANAN DAN PERIODE PENYIMPANAN DATA</h2>
            <h3>Pasal 5 (Perlindungan dan Penyimpanan Data)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Seluruh data pribadi Pengguna disimpan dalam sarana penyimpanan terenkripsi dengan proteksi akses yang ketat.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Dokumen media sensitif (seperti bukti refund atau retur) disimpan dalam lokasi penyimpanan privat (<em>private storage</em>) dan hanya disajikan secara aman kepada akun Pengguna pemilik atau admin resmi.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  Data pribadi Pengguna akan disimpan selama akun Pengguna aktif dan/atau sejauh diperlukan untuk memenuhi kewajiban hukum dan pembukuan akuntansi transaksi.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB VI */}
          <section>
            <h2>BAB VI: HAK-HAK SUBJEK DATA PRIBADI</h2>
            <h3>Pasal 6 (Hak Pengguna atas Data)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  <strong>Hak Akses dan Pembaruan:</strong> Pengguna berhak mengakses dan memperbarui data profil, alamat pengiriman, serta rekening pengembalian dana secara mandiri melalui menu Pengaturan Akun.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  <strong>Hak Penarikan Persetujuan:</strong> Pengguna berhak memperbarui atau menarik persetujuan notifikasi pesan WhatsApp kapan saja pada menu Pengaturan Akun.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  <strong>Hak Penutupan Akun:</strong> Pengguna berhak mengajukan permohonan penutupan akun atau penghapusan data pribadi dengan menghubungi Admin REMPAHKARTA melalui saluran resmi yang tersedia.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB VII */}
          <section>
            <h2>BAB VII: PERUBAHAN KEBIJAKAN PRIVASI</h2>
            <h3>Pasal 7 (Pembaruan Kebijakan)</h3>
            <p>
              REMPAHKARTA dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu untuk menyesuaikan dengan perkembangan hukum atau operasional Platform. Pembaruan akan ditayangkan secara langsung pada halaman ini.
            </p>
          </section>
        </article>
      </main>
      <StoreFooter />
    </>
  );
}
