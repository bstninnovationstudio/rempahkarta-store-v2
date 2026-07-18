export default function Audit() {
  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Tata kelola</p>
          <h1>Audit log</h1>
          <p>Jejak perubahan penting pada pesanan, stok, pembayaran, dan konfigurasi.</p>
        </div>
      </div>
      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Jejak perubahan sistem</caption>
            <thead><tr><th scope="col">Waktu</th><th scope="col">Aktor</th><th scope="col">Aksi</th><th scope="col">Entitas</th><th scope="col">Ringkasan</th></tr></thead>
            <tbody>
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  <div className="admin-table-empty-content">
                    <strong>Data audit belum tersedia pada halaman ini</strong>
                    <span>Halaman tidak menampilkan contoh data agar tidak menyerupai aktivitas sistem yang sebenarnya.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
