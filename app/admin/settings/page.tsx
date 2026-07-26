import { CheckCircle2, CircleAlert, Database, MapPin, PackageCheck, Phone, ServerCog, Settings2, Truck } from "lucide-react";
import { isProduction, getBstnApiKey, getBiteshipApiKey } from "@/lib/env";

function State({ ready, label }: { ready: boolean; label: string }) {
  return <div className="settings-status-row"><span>{label}</span><strong className={`status-pill ${ready ? "status-paid" : "status-pending"}`}>{ready ? "Siap digunakan" : "Belum dikonfigurasi"}</strong></div>;
}

export default function Settings() {
  const mode = process.env.APP_MODE || "development";
  const bstnKey = getBstnApiKey();
  const biteshipKey = getBiteshipApiKey();
  const bstnReady = Boolean(bstnKey);

  return (
    <div className="admin-content admin-settings-page">
      <div className="admin-page-head">
        <div><p className="eyebrow">Konfigurasi sistem</p><h1>Pengaturan sistem</h1><p>Ringkasan kesiapan toko, gudang, integrasi, dan kebijakan operasional.</p></div>
      </div>
      <div className="settings-summary-grid" aria-label="Ringkasan kesiapan sistem">
        <div className="settings-summary-card"><span className="settings-summary-icon"><ServerCog size={17} aria-hidden="true" /></span><div><span>Mode aplikasi</span><strong>{isProduction() ? "Production" : "Development"}</strong></div></div>
        <div className="settings-summary-card"><span className="settings-summary-icon"><PackageCheck size={17} aria-hidden="true" /></span><div><span>Gudang aktif</span><strong>{process.env.WAREHOUSE_NAME || "Gudang Utama"}</strong></div></div>
        <div className="settings-summary-card"><span className="settings-summary-icon"><Settings2 size={17} aria-hidden="true" /></span><div><span>Status pembayaran</span><strong className={bstnReady ? "tone-success-text" : "tone-warning-text"}>{bstnReady ? "Siap digunakan" : "Perlu konfigurasi"}</strong></div></div>
      </div>
      <div className="admin-detail-grid">
        <div>
          <section className="admin-section">
            <div className="settings-section-head"><span className="settings-section-icon"><PackageCheck size={17} aria-hidden="true" /></span><div><h2>Operasional toko</h2><p>Nilai yang dibaca dari environment server.</p></div></div>
            <div className="detail-list">
              <div><span>Mode aplikasi</span><strong>{mode} ({isProduction() ? "Production" : "Development"})</strong></div>
              <div><span>Nama gudang</span><strong>{process.env.WAREHOUSE_NAME || "Gudang Utama REMPAHKARTA"}</strong></div>
              <div><span><Phone size={13} aria-hidden="true" /> Kontak penjemputan</span><strong>{process.env.WAREHOUSE_CONTACT_NAME || "Belum diisi"}</strong></div>
              <div><span><Phone size={13} aria-hidden="true" /> Nomor telepon</span><strong>{process.env.WAREHOUSE_CONTACT_PHONE || "Belum diisi"}</strong></div>
              <div><span><MapPin size={13} aria-hidden="true" /> Alamat gudang</span><strong>{process.env.WAREHOUSE_ADDRESS || "Belum diisi"}</strong></div>
              <div><span><Truck size={13} aria-hidden="true" /> Kurir aktif</span><strong>{process.env.ENABLED_COURIERS || "jne,sicepat,anteraja,jnt"}</strong></div>
            </div>
          </section>
          <section className="admin-section">
            <div className="settings-section-head"><span className="settings-section-icon"><Settings2 size={17} aria-hidden="true" /></span><div><h2>Kebijakan operasional</h2><p>Aturan tetap yang berlaku di seluruh toko.</p></div></div>
            <div className="detail-list">
              <div><span>Batas pengajuan retur</span><strong>7 hari setelah pesanan diterima</strong></div>
              <div><span>Selisih ongkir aktual</span><strong>Ditanggung toko</strong></div>
              <div><span>Pengembalian dana</span><strong>Dicatat manual oleh admin</strong></div>
              <div><span>Media</span><strong>public/uploads (lokal)</strong></div>
            </div>
          </section>
        </div>
        <aside>
          <section className="admin-section">
            <div className="settings-section-head"><span className="settings-section-icon"><Database size={17} aria-hidden="true" /></span><div><h2>Status integrasi</h2><p>Pemeriksaan ketersediaan layanan inti.</p></div></div>
            <div className="detail-list">
              <State ready={bstnReady} label={`BSTN Payment (${isProduction() ? "LIVE" : "DEV"})`} />
              <State ready={Boolean(biteshipKey)} label={`Biteship (${isProduction() ? "LIVE" : "DEV"})`} />
              <State ready={Boolean(process.env.DATABASE_URL)} label="Database MySQL" />
            </div>
          </section>
          <section className="admin-section">
            <h2>
              {!bstnReady
                ? <CircleAlert size={16} aria-hidden="true" />
                : <CheckCircle2 size={16} aria-hidden="true" />}
              Mode pembayaran
            </h2>
            <p className={`settings-note ${!bstnReady ? "tone-warning" : "tone-success"}`}>
              {bstnReady
                ? `BSTN (${isProduction() ? "Production Key" : "Development Key"}) siap digunakan.`
                : `BSTN Key belum diisi untuk mode ${mode}.`}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
