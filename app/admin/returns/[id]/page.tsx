import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminReturnActions } from "@/components/admin-return-actions";
import { prisma } from "@/lib/db";
import { rupiah } from "@/lib/format";

const stateLabels: Record<string, string> = {
  requested: "Perlu ditinjau",
  under_review: "Sedang ditinjau",
  awaiting_approval: "Perlu persetujuan",
  approved: "Disetujui",
  awaiting_handover: "Menunggu pengiriman balik",
  waiting_waybill: "Menunggu nomor resi",
  processing_return: "Retur diproses",
  in_transit: "Dalam perjalanan",
  received: "Perlu inspeksi",
  return_complete: "Retur tiba",
  inspection_passed: "Lolos inspeksi",
  inspection_failed: "Gagal inspeksi",
  refund_pending: "Refund menunggu diproses",
  processing_refund: "Refund diproses",
  refunded: "Refund selesai",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
  closed: "Ditutup",
  finished: "Selesai",
};

function stateClass(state: string) {
  if (["refunded", "closed", "finished", "inspection_passed"].includes(state)) return "status-paid";
  if (["approved", "in_transit", "processing_return", "return_complete"].includes(state)) return "status-processing";
  if (["rejected", "cancelled", "inspection_failed"].includes(state)) return "status-cancelled";
  if (["refund_pending", "processing_refund"].includes(state)) return "status-refund_pending";
  return "status-pending";
}

export default async function ReturnDetail({params}:{params:Promise<{id:string}>}){
  const {id} = await params;
  const ret = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      order: true,
      items: { include: { orderItem: true } },
      refunds: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!ret) notFound();

  const evidence = Array.isArray(ret.evidence)
    ? ret.evidence.filter((item): item is string => typeof item === "string")
    : [];

  const isIssue = ret.source === "issue";

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <Link className="eyebrow admin-back" href="/admin/returns">
            <ArrowLeft size={13} aria-hidden="true" /> Retur dan refund
          </Link>
          <h1 className="admin-data-code admin-title-code">{ret.publicNumber}</h1>
          <p>
            {isIssue ? "Resolusi pesanan bermasalah" : "Pengajuan pelanggan"} dari pesanan <span className="admin-data-code">{ret.order.publicNumber}</span>
          </p>
        </div>
        <span className={`status-pill ${stateClass(ret.state)}`}>{stateLabels[ret.state] || "Status tidak dikenal"}</span>
      </div>

      <div className="admin-detail-grid">
        <div>
          <section className="admin-section" aria-labelledby="return-request-title">
            <h2 id="return-request-title">{isIssue ? "Detail resolusi masalah" : "Permintaan pelanggan"}</h2>
            <div className="detail-list">
              <div>
                <span>{isIssue ? "Tipe Resolusi" : "Alasan"}</span>
                <strong className="text-capitalize">
                  {ret.reason === "refund" ? "Refund Dana" : ret.reason}
                </strong>
              </div>
              {(isIssue || ret.cause) && (
                <div>
                  <span>Penyebab / Case</span>
                  <strong className="text-capitalize">
                    {ret.cause === "damaged" ? "Produk Rusak/Cacat" : ret.cause === "wrong" ? "Produk/Varian Tidak Sesuai" : ret.cause === "incomplete" ? "Pesanan Tidak Lengkap" : (ret.cause || "Tidak spesifik")}
                  </strong>
                </div>
              )}
              <div>
                <span>Deskripsi</span>
                <strong>{ret.description}</strong>
              </div>
              <div>
                <span>Nilai refund</span>
                <strong className="admin-numeric">{rupiah(Number(ret.refundAmount || ret.order.grandTotal))}</strong>
              </div>
            </div>

            {evidence.length > 0 ? (
              <div className="admin-evidence-grid">
                {evidence.map((path, index) => (
                  <div key={path} className="admin-evidence-thumb admin-evidence-contain">
                    <Image unoptimized src={path} alt={`Bukti pengajuan ${index + 1}`} fill />
                  </div>
                ))}
              </div>
            ) : (
              <p className="detail-empty admin-section-empty">Tidak ada bukti gambar yang dilampirkan.</p>
            )}
          </section>

          <section className="admin-section" aria-labelledby="affected-items-title">
            <h2 id="affected-items-title">Item terdampak</h2>
            <div className="affected-item-list">
              {ret.items.map(item => {
                const options = Object.values(item.orderItem.optionsSnapshot as Record<string, string>).filter(Boolean).join(" · ");
                return (
                  <div key={item.id} className="affected-item">
                    <div className="affected-item-copy">
                      <span className="admin-data-code">{item.orderItem.skuSnapshot}</span>
                      <h3>{item.orderItem.nameSnapshot}</h3>
                      <p>
                        {options ? `${options} · ` : ""}{item.quantity} item x {rupiah(Number(item.orderItem.unitPrice))}
                      </p>
                    </div>
                    <strong className="affected-item-total admin-numeric">{rupiah(Number(item.orderItem.unitPrice) * item.quantity)}</strong>
                  </div>
                );
              })}
              {ret.items.length === 0 && <p className="detail-empty admin-section-empty">Tidak ada item yang tercatat untuk pengajuan ini.</p>}
            </div>
          </section>
        </div>

        <aside>
          <section className="admin-section admin-action-rail">
            <h2>Aksi refund</h2>
            <AdminReturnActions
              id={ret.id}
              state={ret.state}
              refundAmount={Number(ret.refundAmount || ret.order.grandTotal)}
              items={ret.items.map(item => ({ id: item.id }))}
              source={ret.source}
            />
          </section>

          {ret.refunds[0] && (
            <section className="admin-section">
              <h2>Refund tercatat</h2>
              <div className="detail-list">
                <div>
                  <span>Nominal</span>
                  <strong className="admin-numeric">{rupiah(Number(ret.refunds[0].amount))}</strong>
                </div>
                <div>
                  <span>Referensi</span>
                  <strong className="admin-data-code">{ret.refunds[0].reference}</strong>
                </div>
                {ret.refunds[0].proofObjectKey && (
                  <div className="admin-refund-proof-wrap">
                    <span>Bukti transfer</span>
                    <div className="admin-refund-proof">
                      <Image unoptimized src={ret.refunds[0].proofObjectKey} alt="Bukti transfer refund" fill />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
