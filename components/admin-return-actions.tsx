"use client";

import { useState } from "react";

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
    <div className="admin-actions-stack">
      {/* 1. Issue Order resolution flows */}
      {isIssue && (
        <>
          {state === "awaiting_approval" && (
            <div className="action-subsection">
              <button
                className="button button-dark"
                disabled={!!busy}
                onClick={() => post("approve", "decision", { decision: "approved", reason: "Persetujuan resolusi pesanan bermasalah", refundAmount })}
              >
                Setujui Resolusi
              </button>
              <div className="action-subsection bordered-top">
                <label className="field">
                  <span>Alasan Penolakan Resolusi</span>
                  <textarea
                    placeholder="Masukkan alasan penolakan..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                </label>
                <button
                  className="button button-light"
                  disabled={!!busy || !rejectReason.trim()}
                  onClick={() => post("reject", "decision", { decision: "rejected", reason: rejectReason })}
                >
                  Tolak Resolusi
                </button>
              </div>
            </div>
          )}

          {(state === "processing_refund" || state === "refund_pending") && (
            <div className="action-subsection">
              <label className="field">
                <span>Nominal Refund</span>
                <input
                  type="number"
                  value={inputRefundAmount}
                  onChange={e => setInputRefundAmount(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Bukti transfer refund</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setProof(e.target.files?.[0] || null)} />
              </label>
              <button className="button button-dark" disabled={!!busy || !proof} onClick={refund}>
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
                className="button button-dark"
                disabled={!!busy}
                onClick={() => post("approve", "decision", { decision: "approved", reason: "Bukti dan permintaan diterima", refundAmount })}
              >
                Setujui refund
              </button>
              <div className="action-subsection bordered-top">
                <label className="field">
                  <span>Alasan Penolakan Refund</span>
                  <textarea
                    placeholder="Masukkan alasan penolakan..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                </label>
                <button
                  className="button button-light"
                  disabled={!!busy || !rejectReason.trim()}
                  onClick={() => post("reject", "decision", { decision: "rejected", reason: rejectReason })}
                >
                  Tolak pengajuan
                </button>
              </div>
            </div>
          )}

          {state === "refund_pending" && (
            <div className="action-subsection">
              <label className="field">
                <span>Nominal Refund</span>
                <input
                  type="number"
                  value={inputRefundAmount}
                  onChange={e => setInputRefundAmount(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Bukti transfer refund</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setProof(e.target.files?.[0] || null)} />
              </label>
              <button className="button button-dark" disabled={!!busy || !proof} onClick={refund}>
                {busy === "refund" ? "Menyimpan…" : "Catat refund manual selesai"}
              </button>
            </div>
          )}
        </>
      )}

      {/* 3. Finished/Cancelled/Rejected states label */}
      {!["requested", "under_review", "refund_pending", "awaiting_approval", "processing_refund"].includes(state) && (
        <p>Tidak ada aksi manual untuk status <strong>{state}</strong>.</p>
      )}

      {message && (
        <p role="status" className={`action-message ${message.includes("berhasil") ? "success" : "error"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
