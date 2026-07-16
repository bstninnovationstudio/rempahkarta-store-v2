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
          <p className="eyebrow">After sales</p>
          <h1>Retur & refund</h1>
          <p>Tinjau bukti, atur pengiriman balik, inspeksi, dan catat refund manual.</p>
        </div>
      </div>

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Perlu ditinjau</span>
            <Clock3 size={15} />
          </div>
          <strong>{review}</strong>
          <span className="metric-trend tone-warning">Urutkan yang tertua</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Menunggu retur</span>
            <RotateCcw size={15} />
          </div>
          <strong>{transit}</strong>
          <span className="metric-trend">Kurir aktif</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Perlu inspeksi</span>
          </div>
          <strong>{inspection}</strong>
          <span className="metric-trend">Barang tiba</span>
        </article>
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Refund manual</span>
            <Check size={15} />
          </div>
          <strong>{refund}</strong>
          <span className="metric-trend tone-danger">Menunggu finance</span>
        </article>
      </section>

      <section className="table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Pesanan</th>
                <th>Sumber</th>
                <th>Tipe</th>
                <th>Alasan/Kendala</th>
                <th>Status</th>
                <th>Refund</th>
                <th>Nilai</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.number}</strong>
                    <span className="sub">{row.createdAt}</span>
                  </td>
                  <td>{row.orderNumber}</td>
                  <td>
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
                    <span className="status-pill">{labels[row.state] || row.state}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${row.refund === "refund_pending" || row.refund === "processing_refund" ? "status-refund_pending" : ["completed", "refunded", "finished"].includes(row.refund) ? "status-paid" : ""}`}>
                      {labels[row.refund] || row.refund}
                    </span>
                  </td>
                  <td>
                    <strong>{rupiah(row.amount)}</strong>
                  </td>
                  <td>
                    <Link href={`/admin/returns/${row.id}`}>
                      <strong>Tinjau →</strong>
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="admin-table-empty">Belum ada pengajuan retur atau refund.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
