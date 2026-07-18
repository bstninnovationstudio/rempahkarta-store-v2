import { CheckCircle2, CircleAlert } from "lucide-react";

function State({ ready, label }: { ready: boolean; label: string }) {
  return <div><span>{label}</span><strong className={`status-pill ${ready ? "status-paid" : "status-pending"}`}>{ready ? "Siap" : "Belum diisi"}</strong></div>;
}

export default function Settings() {
  const paymentMock = process.env.PAYMENT_MOCK === "true";
  const bstnReady = Boolean(process.env.BSTN_PROJECT_API_KEY);
  const paymentReady = paymentMock || bstnReady;

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div><p className="eyebrow">Konfigurasi sistem</p><h1>Pengaturan</h1><p>Ringkasan konfigurasi operasional dari lingkungan server.</p></div>
      </div>
      <div className="admin-detail-grid">
        <div>
          <section className="admin-section">
            <h2>Operasional toko</h2>
            <div className="detail-list">
              <div><span>Nama gudang</span><strong>{process.env.WAREHOUSE_NAME || "Gudang Utama REMPAHKARTA"}</strong></div>
              <div><span>Kontak penjemputan</span><strong>{process.env.WAREHOUSE_CONTACT_NAME || "Belum diisi"}</strong></div>
              <div><span>Telepon</span><strong>{process.env.WAREHOUSE_CONTACT_PHONE || "Belum diisi"}</strong></div>
              <div><span>Alamat</span><strong>{process.env.WAREHOUSE_ADDRESS || "Belum diisi"}</strong></div>
              <div><span>Kurir aktif</span><strong>{process.env.ENABLED_COURIERS || "jne,sicepat,anteraja,jnt"}</strong></div>
            </div>
          </section>
          <section className="admin-section">
            <h2>Kebijakan tetap</h2>
            <div className="detail-list">
              <div><span>Batas pengajuan retur</span><strong>7 hari setelah pesanan diterima</strong></div>
              <div><span>Selisih ongkir aktual</span><strong>Ditanggung toko</strong></div>
              <div><span>Refund</span><strong>Dicatat manual oleh admin</strong></div>
              <div><span>Media</span><strong>public/uploads (lokal)</strong></div>
            </div>
          </section>
        </div>
        <aside>
          <section className="admin-section">
            <h2>Status integrasi</h2>
            <div className="detail-list">
              <State ready={paymentReady} label={paymentMock ? "Mode pembayaran uji" : "Pembayaran BSTN"} />
              <State ready={Boolean(process.env.BITESHIP_API_KEY)} label="Biteship" />
              <State ready={Boolean(process.env.DATABASE_URL)} label="MySQL" />
            </div>
          </section>
          <section className="admin-section">
            <h2>
              {paymentMock || !bstnReady
                ? <CircleAlert size={16} aria-hidden="true" />
                : <CheckCircle2 size={16} aria-hidden="true" />}
              Mode pembayaran
            </h2>
            <p className={`settings-note ${paymentMock || !bstnReady ? "tone-warning" : "tone-success"}`}>
              {paymentMock
                ? "Mode pembayaran uji aktif. Nonaktifkan mode ini sebelum memakai pembayaran BSTN di produksi."
                : bstnReady
                  ? "BSTN siap digunakan; pembayaran lunas diterima setelah verifikasi server."
                  : "Konfigurasi pembayaran BSTN belum lengkap."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
