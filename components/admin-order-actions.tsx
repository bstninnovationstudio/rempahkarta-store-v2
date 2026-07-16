"use client";

import { useEffect, useState } from "react";
import { Box, CheckCircle2, Printer, RefreshCw, Truck, XCircle } from "lucide-react";

const sellerRejectionReasons = [
  "Paket sudah dikemas & siap dikirim",
  "Paket sudah diserahkan ke kurir",
  "Pesanan sudah dalam perjalanan",
  "Alasan lainnya"
];

const sellerDirectCancelReasons = [
  "Stok produk habis",
  "Kesalahan input harga / detail produk",
  "Pelanggan meminta pembatalan lewat chat",
  "Alasan lainnya"
];

export function AdminOrderActions({
  number,
  paymentState,
  fulfillmentState,
  hasShipment,
  collectionMethods,
  cancellationState,
  issueOrder = false,
  issueReason = null,
}:{
  number: string;
  paymentState: string;
  fulfillmentState: string;
  hasShipment: boolean;
  collectionMethods: string[];
  cancellationState?: string;
  cancellationReason?: string | null;
  cancellationDecisionReason?: string | null;
  issueOrder?: boolean;
  issueReason?: string | null;
}){
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState(collectionMethods[0] || "pickup");
  const [reasons, setReasons] = useState<Array<{ code: string; reason: string }>>([]);
  const [reasonCode, setReasonCode] = useState("others");
  
  // State for rejection
  const [rejectionReason, setRejectionReason] = useState(sellerRejectionReasons[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState("");

  // State for direct cancellation
  const [showDirectCancel, setShowDirectCancel] = useState(false);
  const [directCancelReason, setDirectCancelReason] = useState(sellerDirectCancelReasons[0]);
  const [customDirectCancelReason, setCustomDirectCancelReason] = useState("");
  const [directBiteshipReason, setDirectBiteshipReason] = useState("others");

  useEffect(() => {
    // Load Biteship cancellation reasons if cancellation request is active or if order has shipment
    if (["requested", "provider_failed"].includes(cancellationState || "") || hasShipment) {
      fetch("/api/admin/shipping/cancellation-reasons")
        .then(r => r.json())
        .then(data => {
          const values = data.reasons || data.cancellation_reasons || [];
          setReasons(values);
          if (values[0]?.code) {
            setReasonCode(values[0].code);
            setDirectBiteshipReason(values[0].code);
          }
        })
        .catch(() => {});
    }
  }, [cancellationState, hasShipment]);

  async function post(action: string, url: string, payload: unknown) {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.error || `Aksi gagal (${response.status})`);
      setMessage("Perubahan berhasil disimpan.");
      if (result.redirect) {
        setTimeout(() => location.href = result.redirect, 500);
      } else {
        setTimeout(() => location.reload(), 500);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Aksi gagal");
    } finally {
      setBusy("");
    }
  }

  const base = `/api/admin/orders/${encodeURIComponent(number)}`;

  return (
    <>
      <div className="admin-actions-stack">
        {paymentState === "pending" && (
          <button className="button button-light" disabled={!!busy} onClick={() => post("payment-sync", `${base}/payment/sync`, {})}>
            <RefreshCw size={16} /> {busy === "payment-sync" ? "Memeriksa…" : "Sinkronkan BSTN"}
          </button>
        )}
        {fulfillmentState === "awaiting_processing" && (
          <button className="button button-dark" disabled={!!busy || paymentState !== "paid"} onClick={() => post("processing", `${base}/transition`, { state: "processing" })}>
            <CheckCircle2 size={16} /> {busy === "processing" ? "Memproses…" : "Mulai proses"}
          </button>
        )}
        {fulfillmentState === "processing" && (
          <button className="button button-dark" disabled={!!busy} onClick={() => post("packed", `${base}/transition`, { state: "packed" })}>
            <Box size={16} /> {busy === "packed" ? "Menyimpan…" : "Tandai sudah dikemas"}
          </button>
        )}
        {fulfillmentState === "packed" && !hasShipment && (
          <>
            <label className="field">
              <span>Serah terima</span>
              <select value={method} onChange={e => setMethod(e.target.value)}>
                {collectionMethods.map(value => (
                  <option key={value} value={value}>{value === "drop_off" ? "Drop-off" : "Pickup"}</option>
                ))}
              </select>
            </label>
            <button className="button button-dark" disabled={!!busy} onClick={() => post("shipment", `${base}/shipment`, { collectionMethod: method, deliveryType: "now" })}>
              <Truck size={16} /> {busy === "shipment" ? "Membooking…" : "Booking Biteship"}
            </button>
          </>
        )}
        {hasShipment && (
          <button className="button button-light" disabled={!!busy} onClick={() => post("sync", `${base}/shipment/sync`, {})}>
            <RefreshCw size={16} /> {busy === "sync" ? "Sinkronisasi…" : "Sinkronkan Biteship"}
          </button>
        )}

        {/* Cancellation Approval / Rejection Controls */}
        {["requested", "provider_failed"].includes(cancellationState || "") && (
          <div className="action-review action-review-warning">
            <h4 className="action-review-title">Tinjau pengajuan pembatalan</h4>
            
            {/* Approve Block */}
            <div className="action-subsection bordered">
              <label className="field">
                <span>Alasan pembatalan ke Biteship (AWB)</span>
                <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
                  {(reasons.length ? reasons : [{ code: "others", reason: "Alasan lainnya" }]).map(item => (
                    <option key={item.code} value={item.code}>{item.reason}</option>
                  ))}
                </select>
              </label>
              <button className="button button-dark" disabled={!!busy} onClick={() => post("approve", `${base}/cancellation`, { decision: "approved", reason: "Disetujui admin", cancellationReasonCode: reasonCode })}>
                <CheckCircle2 size={15} /> {cancellationState === "provider_failed" ? "Coba pembatalan lagi" : "Setujui & batalkan pesanan"}
              </button>
            </div>

            {/* Reject Block */}
            <div className="action-subsection">
              <label className="field">
                <span>Alasan penolakan penjual</span>
                <select value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}>
                  {sellerRejectionReasons.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
              {rejectionReason === "Alasan lainnya" && (
                <input
                  type="text"
                  placeholder="Tulis alasan penolakan..."
                  value={customRejectionReason}
                  onChange={e => setCustomRejectionReason(e.target.value)}
                  className="action-input"
                />
              )}
              <button className="button button-light" disabled={!!busy} onClick={() => {
                const selectedRejection = rejectionReason === "Alasan lainnya" ? customRejectionReason.trim() : rejectionReason;
                if (rejectionReason === "Alasan lainnya" && selectedRejection.length < 3) {
                  alert("Silakan masukkan alasan penolakan minimal 3 karakter.");
                  return;
                }
                post("reject", `${base}/cancellation`, { decision: "rejected", reason: selectedRejection });
              }}>
                <XCircle size={15} /> Tolak pengajuan
              </button>
            </div>
          </div>
        )}

        {/* Direct Admin Cancellation Controls */}
        {!["cancelled", "completed", "shipment_booked", "handed_over"].includes(fulfillmentState) && paymentState !== "pending" && !["requested", "provider_failed"].includes(cancellationState || "") && !issueOrder && (
          <div>
            {!showDirectCancel ? (
              <button className="button button-danger" onClick={() => setShowDirectCancel(true)}>
                <XCircle size={16} /> Batalkan pesanan langsung
              </button>
            ) : (
              <div className="action-review action-review-danger">
                <h4 className="action-review-title">Batalkan pesanan langsung</h4>
                
                <label className="field">
                  <span>Alasan pembatalan admin</span>
                  <select value={directCancelReason} onChange={e => setDirectCancelReason(e.target.value)}>
                    {sellerDirectCancelReasons.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                {directCancelReason === "Alasan lainnya" && (
                  <input
                    type="text"
                    placeholder="Tulis alasan pembatalan..."
                    value={customDirectCancelReason}
                    onChange={e => setCustomDirectCancelReason(e.target.value)}
                    className="action-input"
                  />
                )}

                {hasShipment && (
                  <label className="field">
                    <span>Alasan pembatalan ke Biteship (wajib)</span>
                    <select value={directBiteshipReason} onChange={e => setDirectBiteshipReason(e.target.value)}>
                      {(reasons.length ? reasons : [{ code: "others", reason: "Alasan lainnya" }]).map(item => (
                        <option key={item.code} value={item.code}>{item.reason}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="action-button-row">
                  <button
                    className="button button-danger-solid"
                    disabled={!!busy}
                    onClick={() => {
                      const selectedDirect = directCancelReason === "Alasan lainnya" ? customDirectCancelReason.trim() : directCancelReason;
                      if (directCancelReason === "Alasan lainnya" && selectedDirect.length < 3) {
                        alert("Silakan masukkan alasan pembatalan minimal 3 karakter.");
                        return;
                      }
                      post("direct-cancel", `${base}/cancellation`, {
                        decision: "approved",
                        reason: selectedDirect,
                        cancellationReasonCode: hasShipment ? directBiteshipReason : undefined
                      });
                    }}
                  >
                    Proses pembatalan
                  </button>
                  <button className="button button-light" onClick={() => setShowDirectCancel(false)}>
                    Kembali
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {issueOrder && (
          <div className="action-review action-review-danger">
            <h4 className="action-review-title">Aksi resolusi</h4>
            <button className="button button-danger-solid" disabled={!!busy} onClick={() => post("resolve-refund", `${base}/resolve`, { type: "refund" })}>
              Proses refund
            </button>

            <button className="button button-light" disabled={!!busy} onClick={() => post("resolve-finish", `${base}/resolve`, { type: "finish" })}>
              Tandai selesai
            </button>
          </div>
        )}

        <button className="button button-light" onClick={() => window.print()}>
          <Printer size={16} /> Cetak picking list
        </button>
      </div>
      {message && (
        <p role="status" className={`action-message ${message.includes("berhasil") ? "success" : "error"}`}>
          {message}
        </p>
      )}
    </>
  );
}
