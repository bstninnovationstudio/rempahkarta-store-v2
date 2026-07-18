import Link from "next/link";
import { Check, Clock3, RotateCcw } from "lucide-react";
import { getReturnRows } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";

const labels: Record<string, string> = {
  requested: "Perlu review",
  under_review: "Ditinjau",
  approved: "Disetujui",
  awaiting_handover: "Menunggu retur",
  in_transit: "Dalam perjalanan",
  received: "Perlu inspeksi",
  inspection_passed: "Lolos inspeksi",
  inspection_failed: "Gagal inspeksi",
  refund_pending: "Refund pending",
  processing_refund: "Refund diproses",
  refunded: "Refund selesai",
  rejected: "Ditolak",
  closed: "Ditutup",
  pending: "Menunggu inspeksi",
  completed: "Refund selesai",
  awaiting_approval: "Perlu persetujuan",
  waiting_waybill: "Menunggu resi",
  processing_return: "Proses retur",
  return_complete: "Retur tiba",
  cancelled: "Ditolak",
  finished: "Selesai"
};

function stateClass(state: string) {
  if (["completed", "refunded", "finished", "closed", "inspection_passed"].includes(state)) return "status-paid";
  if (["approved", "in_transit", "processing_return", "return_complete"].includes(state)) return "status-processing";
  if (["rejected", "cancelled", "inspection_failed"].includes(state)) return "status-cancelled";
  if (["refund_pending", "processing_refund"].includes(state)) return "status-refund_pending";
  return "status-pending";
}

export default async function Returns() {
  const rows = await getReturnRows();
  const review = rows.filter(row => ["requested", "under_review", "awaiting_approval"].includes(row.state)).length;
  const transit = rows.filter(row => ["approved", "awaiting_handover", "in_transit", "waiting_waybill", "processing_return"].includes(row.state)).length;
  const inspection = rows.filter(row => ["received", "return_complete"].includes(row.state)).length;
  const refund = rows.filter(row => row.state === "refund_pending" || row.state === "processing_refund").length;

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Layanan purnajual</p>
          <h1>Retur & refund</h1>
          <p>Tinjau bukti, atur pengiriman balik, inspeksi, dan catat refund manual.</p>
        </div>
      </div>

      <section className="metrics-grid" aria-label="Ringkasan retur dan refund">
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Perlu ditinjau</span>
            <Clock3 size={15} />
          </div>
          <strong className="admin-numeric">{review}</strong>
          <span className="metric-trend tone-warning">Urutkan yang tertua</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Menunggu retur</span>
            <RotateCcw size={15} />
          </div>
          <strong className="admin-numeric">{transit}</strong>
          <span className="metric-trend">Kurir aktif</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Perlu inspeksi</span>
          </div>
          <strong className="admin-numeric">{inspection}</strong>
          <span className="metric-trend">Barang tiba</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Refund manual</span>
            <Check size={15} />
          </div>
          <strong className="admin-numeric">{refund}</strong>
          <span className="metric-trend tone-danger">Menunggu finance</span>
        </article>
      </section>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="admin-table-caption">Daftar pengajuan retur, refund, dan resolusi pesanan</caption>
            <thead>
              <tr>
                <th scope="col">Kasus</th>
                <th scope="col">Pesanan</th>
                <th scope="col">Sumber</th>
                <th scope="col">Tipe</th>
                <th scope="col">Alasan / kendala</th>
                <th scope="col">Status</th>
                <th scope="col">Refund</th>
                <th scope="col">Nilai</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <strong className="admin-data-code">{row.number}</strong>
                    <span className="sub">{row.createdAt}</span>
                  </td>
                  <td><span className="admin-data-code">{row.orderNumber}</span></td>
                  <td className="admin-table-cell-wrap admin-reason-cell">
                    <span className={`status-pill ${row.source === "issue" ? "status-refund_pending" : "status-pending"}`}>
                      {row.source === "issue" ? "Pesanan bermasalah" : "Pelanggan"}
                    </span>
                  </td>
                  <td>
                    <strong className="text-capitalize">
                      {row.type === "refund" ? "Refund" : "Retur"}
                    </strong>
                  </td>
                  <td>
                    {row.source === "issue"
                      ? `Kendala: ${row.reason}`
                      : `${row.cause === "damaged" ? "Produk Rusak" : row.cause === "wrong" ? "Salah Varian" : row.cause === "incomplete" ? "Tidak Lengkap" : row.cause === "change" ? "Kembalikan Produk" : row.reason}`}
                  </td>
                  <td>
                    <span className={`status-pill ${stateClass(row.state)}`}>{labels[row.state] || "Status tidak dikenal"}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${stateClass(row.refund)}`}>
                      {labels[row.refund] || "Status tidak dikenal"}
                    </span>
                  </td>
                  <td>
                    <strong className="admin-numeric">{rupiah(row.amount)}</strong>
                  </td>
                  <td>
                    <Link href={`/admin/returns/${row.id}`} className="table-link">Tinjau<span aria-hidden="true"> →</span></Link>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="admin-table-empty">Belum ada pengajuan retur, refund, atau resolusi pesanan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
