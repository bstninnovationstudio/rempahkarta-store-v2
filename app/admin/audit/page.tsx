export default function Audit() {
  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Governance</p>
          <h1>Audit log</h1>
          <p>Jejak perubahan penting pada pesanan, stok, pembayaran, dan konfigurasi.</p>
        </div>
      </div>
      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entity</th><th>Ringkasan</th></tr></thead>
            <tbody>
              <tr><td>13 Jul 10.17</td><td>admin@amk.store</td><td>order.packed</td><td>ORD-20260713-8F3K</td><td>Berat aktual 250g, dimensi 28×22×4cm</td></tr>
              <tr><td>13 Jul 09.44</td><td>system:bstn</td><td>payment.paid</td><td>PAY-8F3K</td><td>Signature valid, nominal cocok</td></tr>
              <tr><td>13 Jul 09.42</td><td>system</td><td>inventory.reserved</td><td>AMK-SHN-WHT-M</td><td>Reserved +1 untuk ORD-20260713-8F3K</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
