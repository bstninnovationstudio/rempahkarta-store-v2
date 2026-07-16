import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminReturnActions } from "@/components/admin-return-actions";
import { prisma } from "@/lib/db";
import { rupiah } from "@/lib/format";

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
          <Link className="eyebrow" href="/admin/returns">
            <ArrowLeft size={13}/> Semua pengajuan refund
          </Link>
          <h1>{ret.publicNumber}</h1>
          <p>
            {isIssue ? `Resolusi Pesanan Bermasalah ${ret.order.publicNumber}` : `Pengajuan Refund Pelanggan dari Pesanan ${ret.order.publicNumber}`} · Status: <strong>{ret.state}</strong>
          </p>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div>
          <section className="admin-section">
            <h2>{isIssue ? "Detail Resolusi Masalah" : "Permintaan pelanggan"}</h2>
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
                <strong>{rupiah(Number(ret.refundAmount || ret.order.grandTotal))}</strong>
              </div>
            </div>

            {evidence.length > 0 && (
              <div className="admin-evidence-grid">
                {evidence.map(path => (
                  <div key={path} className="admin-evidence-thumb">
                    <Image unoptimized src={path} alt="Bukti refund" fill />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section">
            <h2>Item terdampak</h2>
            <div className="affected-item-list">
              {ret.items.map(item => {
                const options = Object.values(item.orderItem.optionsSnapshot as Record<string, string>).filter(Boolean).join(" · ");
                return (
                  <div key={item.id} className="affected-item">
                    <div className="affected-item-copy">
                      <span>{item.orderItem.skuSnapshot}</span>
                      <h3>{item.orderItem.nameSnapshot}</h3>
                      <p>
                        {options ? `${options} · ` : ""}{item.quantity} item x {rupiah(Number(item.orderItem.unitPrice))}
                      </p>
                    </div>
                    <strong className="affected-item-total">{rupiah(Number(item.orderItem.unitPrice) * item.quantity)}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside>
          <section className="admin-section">
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
                  <strong>{rupiah(Number(ret.refunds[0].amount))}</strong>
                </div>
                <div>
                  <span>Referensi</span>
                  <strong>{ret.refunds[0].reference}</strong>
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
