"use client";

import Script from "next/script";
import { useEffect, useId, useState } from "react";
import { Box, CheckCircle2, Printer, RefreshCw, Truck, XCircle } from "lucide-react";
import { useTurnstile } from "@/components/use-turnstile";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (process.env.NEXT_PUBLIC_APP_MODE !== "production" ? "1x00000000000000000000BB" : "");

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
  cancellationReason,
  cancellationDecisionReason,
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
  const directCancelId = useId();
  const rejectionCustomId = useId();
  const directCustomId = useId();
  const { containerRef, token: getTurnstileToken } = useTurnstile(turnstileSiteKey);

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

  async function post(action: string, url: string, payload: unknown, turnstileAction?: string) {
    setBusy(action);
    setMessage("");
    try {
      const body = turnstileAction
        ? { ...(payload as Record<string, unknown>), turnstileToken: await getTurnstileToken(turnstileAction) }
        : payload;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
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
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div className="admin-actions-stack" aria-busy={Boolean(busy)}>
        {paymentState === "pending" && (
          <button type="button" className="button button-light" disabled={!!busy} onClick={() => post("payment-sync", `${base}/payment/sync`, {}, "admin_payment_sync")}>
            <RefreshCw size={16} /> {busy === "payment-sync" ? "Memeriksa…" : "Sinkronkan BSTN"}
          </button>
        )}
        {fulfillmentState === "awaiting_processing" && (
          <button type="button" className="button button-dark" disabled={!!busy || paymentState !== "paid"} onClick={() => post("processing", `${base}/transition`, { state: "processing" })}>
            <CheckCircle2 size={16} /> {busy === "processing" ? "Memproses…" : "Mulai proses"}
          </button>
        )}
        {fulfillmentState === "processing" && (
          <button type="button" className="button button-dark" disabled={!!busy} onClick={() => post("packed", `${base}/transition`, { state: "packed" })}>
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
            <button type="button" className="button button-dark" disabled={!!busy} onClick={() => post("shipment", `${base}/shipment`, { collectionMethod: method, deliveryType: "now" })}>
              <Truck size={16} /> {busy === "shipment" ? "Memproses…" : "ATUR PENGIRIMAN"}
            </button>
          </>
        )}
        {hasShipment && (
          <>
            <a href={`/admin/orders/${encodeURIComponent(number)}/resi`} target="_blank" rel="noopener noreferrer" className="button button-dark">
              <Printer size={16} /> CETAK RESI (A6)
            </a>
            <button type="button" className="button button-light" disabled={!!busy} onClick={() => post("sync", `${base}/shipment/sync`, {})}>
              <RefreshCw size={16} /> {busy === "sync" ? "Sinkronisasi…" : "Sinkronkan Biteship"}
            </button>
          </>
        )}

        {/* Cancellation Approval / Rejection Controls */}
        {["requested", "provider_failed"].includes(cancellationState || "") && (
          <div className="action-review action-review-warning">
            <h4 className="action-review-title">Tinjau pengajuan pembatalan</h4>
            {cancellationReason && <p className="action-context"><strong>Alasan pelanggan:</strong> {cancellationReason}</p>}
            {cancellationDecisionReason && <p className="action-context"><strong>Catatan keputusan sebelumnya:</strong> {cancellationDecisionReason}</p>}
            
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
              <button type="button" className="button button-dark" disabled={!!busy} onClick={() => post("approve", `${base}/cancellation`, { decision: "approved", reason: "Disetujui admin", cancellationReasonCode: reasonCode })}>
                <CheckCircle2 size={15} /> {busy === "approve" ? "Memproses…" : cancellationState === "provider_failed" ? "Coba pembatalan lagi" : "Setujui & batalkan pesanan"}
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
                <label className="field" htmlFor={rejectionCustomId}>
                  <span>Alasan penolakan lainnya</span>
                  <input id={rejectionCustomId} type="text" placeholder="Tulis alasan penolakan…" value={customRejectionReason} onChange={e => setCustomRejectionReason(e.target.value)} className="action-input"/>
                </label>
              )}
              <button type="button" className="button button-light" disabled={!!busy} onClick={() => {
                const selectedRejection = rejectionReason === "Alasan lainnya" ? customRejectionReason.trim() : rejectionReason;
                if (rejectionReason === "Alasan lainnya" && selectedRejection.length < 3) {
                  setMessage("Silakan masukkan alasan penolakan minimal 3 karakter.");
                  return;
                }
                post("reject", `${base}/cancellation`, { decision: "rejected", reason: selectedRejection });
              }}>
                <XCircle size={15} /> {busy === "reject" ? "Menolak…" : "Tolak pengajuan"}
              </button>
            </div>
          </div>
        )}

        {/* Direct Admin Cancellation Controls */}
        {!["cancelled", "completed", "shipment_booked", "handed_over"].includes(fulfillmentState) && paymentState !== "pending" && !["requested", "provider_failed"].includes(cancellationState || "") && !issueOrder && (
          <div className="direct-cancel-disclosure">
            {!showDirectCancel ? (
              <button type="button" className="button button-danger" aria-expanded="false" aria-controls={directCancelId} onClick={() => setShowDirectCancel(true)}>
                <XCircle size={16} /> Batalkan pesanan langsung
              </button>
            ) : (
              <div id={directCancelId} className="action-review action-review-danger">
                <h4 className="action-review-title">Batalkan pesanan langsung</h4>
                <p className="action-context">Tindakan ini memproses pembatalan pesanan. Pastikan alasan dan status pengiriman sudah sesuai.</p>
                
                <label className="field">
                  <span>Alasan pembatalan admin</span>
                  <select value={directCancelReason} onChange={e => setDirectCancelReason(e.target.value)}>
                    {sellerDirectCancelReasons.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                {directCancelReason === "Alasan lainnya" && (
                  <label className="field" htmlFor={directCustomId}>
                    <span>Alasan pembatalan lainnya</span>
                    <input id={directCustomId} type="text" placeholder="Tulis alasan pembatalan…" value={customDirectCancelReason} onChange={e => setCustomDirectCancelReason(e.target.value)} className="action-input"/>
                  </label>
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
                    type="button"
                    className="button button-danger-solid"
                    disabled={!!busy}
                    onClick={() => {
                      const selectedDirect = directCancelReason === "Alasan lainnya" ? customDirectCancelReason.trim() : directCancelReason;
                      if (directCancelReason === "Alasan lainnya" && selectedDirect.length < 3) {
                        setMessage("Silakan masukkan alasan pembatalan minimal 3 karakter.");
                        return;
                      }
                      post("direct-cancel", `${base}/cancellation`, {
                        decision: "approved",
                        reason: selectedDirect,
                        cancellationReasonCode: hasShipment ? directBiteshipReason : undefined
                      });
                    }}
                  >
                    {busy === "direct-cancel" ? "Memproses…" : "Proses pembatalan"}
                  </button>
                  <button type="button" className="button button-light" disabled={Boolean(busy)} onClick={() => setShowDirectCancel(false)}>
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
            {issueReason && <p className="action-context"><strong>Masalah:</strong> {issueReason}</p>}
            <button type="button" className="button button-danger-solid" disabled={!!busy} onClick={() => post("resolve-refund", `${base}/resolve`, { type: "refund" })}>
              {busy === "resolve-refund" ? "Memproses refund…" : "Proses refund"}
            </button>

            <button type="button" className="button button-light" disabled={!!busy} onClick={() => post("resolve-finish", `${base}/resolve`, { type: "finish" })}>
              {busy === "resolve-finish" ? "Menyimpan…" : "Tandai selesai"}
            </button>
          </div>
        )}

        <button type="button" className="button button-light" onClick={() => window.print()}>
          <Printer size={16} /> Cetak picking list
        </button>
      </div>
      {message && (
        <p role={message.includes("berhasil") ? "status" : "alert"} className={`action-message ${message.includes("berhasil") ? "success" : "error"}`}>
          {message}
        </p>
      )}
      <div ref={containerRef} className="turnstile-container" aria-live="polite" />
    </>
  );
}
