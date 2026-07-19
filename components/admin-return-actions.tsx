"use client";

import { useId, useState } from "react";

const returnStateLabels: Record<string, string> = {
  approved: "disetujui",
  awaiting_handover: "menunggu serah terima",
  in_transit: "dalam pengiriman retur",
  received: "barang diterima",
  inspection_passed: "pemeriksaan lolos",
  inspection_failed: "pemeriksaan gagal",
  refunded: "sudah direfund",
  closed: "ditutup",
  waiting_waybill: "menunggu resi",
  processing_return: "memproses retur",
  return_complete: "retur selesai",
  cancelled: "dibatalkan",
  finished: "selesai",
  rejected: "ditolak",
};

export function AdminReturnActions({
  id,
  state,
  refundAmount,
  items,
  source = "buyer"
}: {
  id: string;
  state: string;
  refundAmount: number;
  items: Array<{ id: string }>;
  source?: string;
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [inputRefundAmount, setInputRefundAmount] = useState(refundAmount);
  const [rejectReason, setRejectReason] = useState("");
  const rejectReasonId = useId();
  const refundAmountId = useId();
  const refundProofId = useId();
  const messageIsSuccess = message.includes("berhasil");

  async function post(action: string, path: string, payload: unknown) {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/returns/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Aksi gagal");
      setMessage("Perubahan berhasil disimpan.");
      setTimeout(() => location.reload(), 600);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Aksi gagal");
    } finally {
      setBusy("");
    }
  }

  async function refund() {
    if (!proof) {
      setMessage("Pilih bukti transfer refund.");
      return;
    }
    setBusy("refund");
    setMessage("");
    try {
      const form = new FormData();
      form.set("scope", "refunds");
      form.set("entityId", id);
      form.set("file", proof);
      const uploaded = await fetch("/api/admin/media/upload-url", {
        method: "POST",
        body: form
      });
      const file = await uploaded.json();
      if (!uploaded.ok) throw new Error(file.error || "Upload bukti gagal");
      await post("refund", "refund", {
        amount: inputRefundAmount,
        method: "transfer_manual",
        reference: `REF-${Date.now()}`,
        proofObjectKey: file.path
      });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Refund gagal");
      setBusy("");
    }
  }

  const isIssue = source === "issue";

  return (
    <div className="admin-actions-stack" aria-busy={Boolean(busy)}>
      {items.length > 0 && <p className="action-context action-summary">Pengajuan ini mencakup {items.length} item terdampak.</p>}
      {/* 1. Issue Order resolution flows */}
      {isIssue && (
        <>
          {state === "awaiting_approval" && (
            <div className="action-subsection">
              <button
                type="button"
                className="button button-dark"
                disabled={!!busy}
                onClick={() => post("approve", "decision", { decision: "approved", reason: "Persetujuan resolusi pesanan bermasalah", refundAmount })}
              >
                {busy === "approve" ? "Menyetujui…" : "Setujui resolusi"}
              </button>
              <div className="action-subsection bordered-top">
                <label className="field" htmlFor={rejectReasonId}>
                  <span>Alasan penolakan resolusi</span>
                  <textarea
                    id={rejectReasonId}
                    placeholder="Masukkan alasan penolakan…"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <small>Alasan wajib diisi sebelum pengajuan ditolak.</small>
                </label>
                <button
                  type="button"
                  className="button button-light"
                  disabled={!!busy || !rejectReason.trim()}
                  onClick={() => post("reject", "decision", { decision: "rejected", reason: rejectReason })}
                >
                  {busy === "reject" ? "Menolak…" : "Tolak resolusi"}
                </button>
              </div>
            </div>
          )}

          {(state === "processing_refund" || state === "refund_pending") && (
            <div className="action-subsection">
              <label className="field" htmlFor={refundAmountId}>
                <span>Nominal refund</span>
                <input
                  id={refundAmountId}
                  type="number"
                  inputMode="numeric"
                  value={inputRefundAmount}
                  onChange={e => setInputRefundAmount(Number(e.target.value))}
                />
                <small>Masukkan nominal dalam rupiah, tanpa titik atau koma.</small>
              </label>
              <label className="field" htmlFor={refundProofId}>
                <span>Bukti transfer refund</span>
                <input id={refundProofId} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setProof(e.target.files?.[0] || null)} />
                <small>{proof ? `File dipilih: ${proof.name}` : "Pilih JPG, PNG, atau WebP sebagai bukti transfer."}</small>
              </label>
              <button type="button" className="button button-dark" disabled={!!busy || !proof} onClick={refund}>
                {busy === "refund" ? "Menyimpan…" : "Catat Refund Selesai"}
              </button>
            </div>
          )}
        </>
      )}

      {/* 2. Normal Buyer Return Request flows */}
      {!isIssue && (
        <>
          {["requested", "under_review"].includes(state) && (
            <div className="action-subsection">
              <button
                type="button"
                className="button button-dark"
                disabled={!!busy}
                onClick={() => post("approve", "decision", { decision: "approved", reason: "Bukti dan permintaan diterima", refundAmount })}
              >
                {busy === "approve" ? "Menyetujui…" : "Setujui refund"}
              </button>
              <div className="action-subsection bordered-top">
                <label className="field" htmlFor={rejectReasonId}>
                  <span>Alasan penolakan refund</span>
                  <textarea
                    id={rejectReasonId}
                    placeholder="Masukkan alasan penolakan…"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <small>Alasan wajib diisi sebelum pengajuan ditolak.</small>
                </label>
                <button
                  type="button"
                  className="button button-light"
                  disabled={!!busy || !rejectReason.trim()}
                  onClick={() => post("reject", "decision", { decision: "rejected", reason: rejectReason })}
                >
                  {busy === "reject" ? "Menolak…" : "Tolak pengajuan"}
                </button>
              </div>
            </div>
          )}

          {state === "refund_pending" && (
            <div className="action-subsection">
              <label className="field" htmlFor={refundAmountId}>
                <span>Nominal refund</span>
                <input
                  id={refundAmountId}
                  type="number"
                  inputMode="numeric"
                  value={inputRefundAmount}
                  onChange={e => setInputRefundAmount(Number(e.target.value))}
                />
                <small>Masukkan nominal dalam rupiah, tanpa titik atau koma.</small>
              </label>
              <label className="field" htmlFor={refundProofId}>
                <span>Bukti transfer refund</span>
                <input id={refundProofId} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setProof(e.target.files?.[0] || null)} />
                <small>{proof ? `File dipilih: ${proof.name}` : "Pilih JPG, PNG, atau WebP sebagai bukti transfer."}</small>
              </label>
              <button type="button" className="button button-dark" disabled={!!busy || !proof} onClick={refund}>
                {busy === "refund" ? "Menyimpan…" : "Catat refund manual selesai"}
              </button>
            </div>
          )}
        </>
      )}

      {/* 3. Finished/Cancelled/Rejected states label */}
      {!["requested", "under_review", "refund_pending", "awaiting_approval", "processing_refund"].includes(state) && (
        <p className="action-context">Tidak ada aksi manual untuk status <strong>{returnStateLabels[state] || state}</strong>.</p>
      )}

      {message && (
        <p role={messageIsSuccess ? "status" : "alert"} className={`action-message ${messageIsSuccess ? "success" : "error"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
