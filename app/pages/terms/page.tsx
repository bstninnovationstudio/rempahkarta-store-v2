import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat & ketentuan",
  description: "Syarat dan ketentuan penggunaan platform resmi REMPAHKARTA, ketentuan pemesanan produk rempah dan bahan makanan, pembatalan, pengiriman logistik, serta kebijakan refund.",
  alternates: { canonical: "/pages/terms" },
};

export default function TermsPage() {
  return (
    <>
      <StoreHeader />
      <main className="simple-page policy-page">
        <div className="page-title">
          <p className="eyebrow">Legalitas &amp; Ketentuan</p>
          <h1>Syarat &amp; ketentuan</h1>
        </div>

        <article className="policy-panel">
          {/* BAB I */}
          <section>
            <h2>BAB I: KETENTUAN UMUM</h2>
            <h3>Pasal 1 (Definisi)</h3>
            <p>
              Dalam Syarat dan Ketentuan ini, kecuali ditentukan lain oleh konteks kalimat, istilah-istilah di bawah ini memiliki arti sebagai berikut:
            </p>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  <strong>REMPAHKARTA</strong> adalah brand usaha spesialis produk rempah-rempah, bumbu alami, serta bahan makanan dan minuman berkualitas. Situs web ini berfungsi sebagai sarana dan media transaksi penjualan resmi produk REMPAHKARTA secara langsung kepada konsumen (<em>Direct-to-Consumer / D2C</em>).
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  <strong>Pengguna / Pembeli</strong> adalah setiap individu atau badan yang mengakses Platform, mendaftarkan akun, dan/atau melakukan transaksi pembelian produk di REMPAHKARTA.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  <strong>Mitra Logistik (Biteship)</strong> adalah pihak ketiga penyedia agregator layanan pengiriman dan ekspedisi terintegrasi yang bekerja sama dengan REMPAHKARTA untuk menangani pengiriman paket pesanan kepada Pembeli.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  <strong>Mitra Pembayaran (BSTN)</strong> adalah pihak ketiga penyedia jasa pembayaran resmi (<em>payment gateway</em>) yang memproses transaksi pembayaran digital berbasis QRIS (<em>Quick Response Code Indonesian Standard</em>).
                </div>
              </li>
              <li>
                <span className="ayat-num">(5)</span>
                <div>
                  <strong>Layanan Komunikasi (WhatsApp)</strong> adalah fasilitas transmisi pesan otomatis melalui aplikasi WhatsApp untuk pengiriman kode verifikasi (OTP) dan notifikasi status pesanan atas izin Pengguna.
                </div>
              </li>
              <li>
                <span className="ayat-num">(6)</span>
                <div>
                  <strong>Platform</strong> adalah situs web resmi penjualan REMPAHKARTA beserta seluruh fitur, halaman, dan sistem transaksi yang tersedia di dalamnya.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB II */}
          <section>
            <h2>BAB II: SYARAT PENGGUNAAN PLATFORM DAN AKUN</h2>
            <h3>Pasal 2 (Registrasi dan Keamanan Akun)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Pengguna wajib berusia sekurang-kurangnya 17 (tujuh belas) tahun atau telah cakap secara hukum sesuai dengan ketentuan peraturan perundang-undangan di Indonesia.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Pengguna wajib melakukan autentikasi masuk (<em>login</em>) menggunakan layanan identitas resmi Google (<em>Google Identity</em>) yang sah dan terverifikasi.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  Pengguna bertanggung jawab penuh atas kerahasiaan dan penggunaan akun Google yang terhubung pada Platform REMPAHKARTA.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  Sebelum melakukan transaksi pemesanan (<em>checkout</em>), Pengguna wajib melengkapi data profil akun yang valid mencakup nama lengkap, alamat email aktif, nomor telepon yang dapat dihubungi, minimal satu alamat pengiriman lengkap, serta nomor rekening bank untuk keperluan pengembalian dana (<em>refund</em>).
                </div>
              </li>
            </ul>
          </section>

          {/* BAB III */}
          <section>
            <h2>BAB III: PEMESANAN DAN PEMBAYARAN</h2>
            <h3>Pasal 3 (Prosedur Pemesanan dan Pembayaran)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Pemesanan produk rempah dan bahan makanan dianggap sah dan mengikat setelah Pengguna menyelesaikan tahapan <em>checkout</em> dan konfirmasi rincian tagihan pembayaran.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Seluruh pembayaran transaksi dilakukan secara digital melalui mekanisme QRIS resmi yang diterbitkan oleh Mitra Pembayaran. Pengguna wajib melakukan pembayaran sebelum batas waktu (<em>expiry time</em>) yang ditentukan pada rincian tagihan.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  REMPAHKARTA berhak membatalkan pesanan secara otomatis apabila pembayaran tidak terverifikasi dalam batas waktu pembayaran yang berlaku.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB IV */}
          <section>
            <h2>BAB IV: KETENTUAN PEMBATALAN PESANAN</h2>
            <h3>Pasal 4 (Hak dan Batasan Pembatalan Pesanan)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  <strong>Pembatalan oleh Pembeli:</strong> Pembeli hanya memiliki hak untuk membatalkan pesanan secara mandiri dalam sistem apabila pesanan belum diproses (<em>status pending payment / belum masuk tahap kemas</em>).
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  <strong>Pesanan Dikemas:</strong> Pesanan yang telah diproses dan masuk dalam tahap pengemasan (<em>status processing / dikemas</em>) <strong>TIDAK DAPAT DIBATALKAN</strong> oleh Pembeli dengan alasan apapun.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  <strong>Pembatalan oleh Admin:</strong> Admin REMPAHKARTA berhak membatalkan pesanan dalam kasus khusus (seperti ketidaksesuaian stok atau kendala operasional mendesak) sebelum pesanan diserahkan ke tahap pengiriman.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  <strong>Pesanan Dikerahkan ke Kurir:</strong> Setelah pesanan diserahkan kepada kurir ekspedisi (<em>status pengiriman / shipped</em>), pesanan <strong>TIDAK DAPAT DIBATALKAN</strong> oleh pihak manapun (baik Pembeli maupun Admin), kecuali terdapat indikasi masalah khusus atau keadaan kahar (<em>force majeure</em>) dari pihak penyedia pengiriman.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB V */}
          <section>
            <h2>BAB V: PENGIRIMAN DAN TANGGUNG JAWAB LOGISTIK</h2>
            <h3>Pasal 5 (Pelaksanaan Pengiriman dan Pengalihan Tanggung Jawab)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Pengiriman produk diselenggarakan melalui kemitraan dengan penyedia layanan logistik <strong>Biteship</strong> dan jaringan ekspedisi terhubung yang dipilih saat checkout.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Pesanan yang telah dikirimkan dan memiliki nomor resi pelacakan resmi secara hukum menjadi tanggung jawab dari Penyedia Layanan Logistik (Biteship) sesuai dengan ketentuan kerja sama yang berlaku.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  Apabila terjadi kendala pengiriman, kerusakan paket di perjalanan, atau kehilangan barang oleh pihak ekspedisi, proses investigasi dan resolusi internal dilakukan secara langsung antara REMPAHKARTA dan pihak Biteship.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  Atas kendala pengiriman yang terbukti akibat kelalaian atau masalah pada pihak penyedia logistik, Pembeli berhak memperoleh kompensasi atau pengembalian dana (<em>refund</em>) yang diatur sesuai Kebijakan Pengembalian Dana pada Pasal 6.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB VI */}
          <section>
            <h2>BAB VI: KEBIJAKAN PENGEMBALIAN DANA (REFUND) DAN RESOLUSI MASALAH</h2>
            <h3>Pasal 6 (Ketentuan Pengembalian Dana / Refund)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  <strong>Tidak Ada Pengembalian Barang Fisik (No Physical Return):</strong> Platform REMPAHKARTA tidak menerapkan mekanisme pengembalian barang fisik secara konvensional. Barang yang telah diterima oleh Pembeli menjadi hak Pembeli sepenuhnya, dan resolusi atas ketidaksesuaian atau kerusakan dilakukan melalui skema pengajuan kompensasi pengembalian dana (<em>refund</em>) dalam aplikasi.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  <strong>Ketentuan Ongkos Kirim:</strong> Apabila pesanan telah diproses dan masuk ke dalam tahap pengiriman, <strong>tidak ada pengembalian dana atas biaya ongkos kirim</strong> dalam bentuk atau kasus apapun.
                </div>
              </li>
              <li>
                <span className="ayat-num">(3)</span>
                <div>
                  <strong>Batas Waktu Pengajuan Klaim:</strong> Pengajuan klaim masalah atau permohonan <em>refund</em> wajib disampaikan oleh Pembeli melalui halaman rincian pesanan paling lambat <strong>H+7 (7 hari kalender)</strong> sejak status pesanan dinyatakan diterima (<em>delivered</em>). Pengajuan yang melewati batas waktu tersebut tidak dapat diproses.
                </div>
              </li>
              <li>
                <span className="ayat-num">(4)</span>
                <div>
                  <strong>Pengelolaan Refund:</strong> Pengembalian dana dikelola secara terpisah oleh tim keuangan berdasarkan jenis masalah yang terverifikasi (misalnya produk rusak/kurang) dan diproses ke rekening pengembalian dana yang terdaftar pada profil Pengguna.
                </div>
              </li>
              <li>
                <span className="ayat-num">(5)</span>
                <div>
                  <strong>Transaksi dan Diskusi Khusus:</strong> Seluruh proses pengajuan wajib dilakukan secara resmi melalui transaksi dalam aplikasi. Apabila terdapat situasi atau kasus khusus di luar ketentuan standar, Pengguna dapat mendiskusikannya dengan Admin melalui saluran percakapan resmi yang disediakan pada Platform.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB VII */}
          <section>
            <h2>BAB VII: HAK KEKAYAAN INTELEKTUAL</h2>
            <h3>Pasal 7 (Perlindungan Hak Cipta dan Merek)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Seluruh logo, merek dagang REMPAHKARTA, desain visual, foto produk rempah, teks editorial, serta kode sumber pada Platform merupakan hak kekayaan intelektual milik REMPAHKARTA yang dilindungi oleh undang-undang.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Setiap pihak dilarang mengutip, menggandakan, mendistribusikan, atau menggunakan aset visual dan merek REMPAHKARTA tanpa persetujuan tertulis resmi dari penyedia layanan.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB VIII */}
          <section>
            <h2>BAB VIII: LARANGAN DAN SANKSI</h2>
            <h3>Pasal 8 (Larangan dan Pembatasan Akun)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Pengguna dilarang keras melakukan manipulasi data, transaksi fiktif, kecurangan pembayaran, penyalahgunaan fitur klaim, atau tindakan ilegal lainnya yang merugikan REMPAHKARTA.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Pelanggaran terhadap ketentuan ini berakibat pada pembekuan akun (<em>pause</em>), pemblokiran permanen (<em>block</em>), serta pembatalan seluruh hak klaim tanpa pemberitahuan terlebih dahulu.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB IX */}
          <section>
            <h2>BAB IX: BATASAN TANGGUNG JAWAB</h2>
            <h3>Pasal 9 (Keadaan Kahar / Force Majeure)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  REMPAHKARTA dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan pelaksanaan kewajiban yang disebabkan oleh kejadian di luar kendali wajar (<em>force majeure</em>), mencakup namun tidak terbatas pada bencana alam, pandemi, gangguan jaringan telekomunikasi nasional, atau kebijakan pemerintah.
                </div>
              </li>
            </ul>
          </section>

          {/* BAB X */}
          <section>
            <h2>BAB X: HUKUM YANG BERLAKU DAN PENYELESAIAN SENGKETA</h2>
            <h3>Pasal 10 (Hukum dan Yurisdiksi)</h3>
            <ul className="policy-ayat-list">
              <li>
                <span className="ayat-num">(1)</span>
                <div>
                  Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum yang berlaku di Negara Kesatuan Republik Indonesia.
                </div>
              </li>
              <li>
                <span className="ayat-num">(2)</span>
                <div>
                  Segala sengketa yang timbul dari atau sehubungan dengan penggunaan Platform REMPAHKARTA akan diselesaikan terlebih dahulu secara musyawarah untuk mufakat.
                </div>
              </li>
            </ul>
          </section>
        </article>
      </main>
      <StoreFooter />
    </>
  );
}
