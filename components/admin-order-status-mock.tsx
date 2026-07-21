"use client";

import { useState } from "react";
import { Copy, RefreshCw, Trash2 } from "lucide-react";

export function AdminOrderStatusMock({
  number,
  fulfillmentState,
  issueOrder = false,
}: {
  number: string;
  fulfillmentState: string;
  issueOrder?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("processing");

  const baseApiUrl = `/api/admin/orders/${encodeURIComponent(number)}`;

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    setBusy("simulate");
    setMessage("");

    let payloadType: "fulfillment" | "biteship" | "issue" = "fulfillment";
    let payloadStatus = selectedStatus;

    if (selectedStatus.startsWith("biteship_")) {
      payloadType = "biteship";
      payloadStatus = selectedStatus.replace("biteship_", "");
    } else if (selectedStatus.startsWith("issue_")) {
      payloadType = "issue";
      payloadStatus = selectedStatus.replace("issue_", "");
    }

    try {
      const response = await fetch(`${baseApiUrl}/manual-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: payloadType, status: payloadStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengirim simulasi status.");
      
      setMessage("Status berhasil disimulasikan! Memuat ulang...");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy("");
    }
  }

  async function handleDuplicate() {
    if (!confirm("Duplikasi pesanan ini sebagai pesanan baru dengan status setelah bayar?")) {
      return;
    }
    setBusy("duplicate");
    setMessage("");

    try {
      const response = await fetch(`${baseApiUrl}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menduplikasi pesanan.");

      setMessage(`Pesanan berhasil diduplikasi: ${data.order_number}! Mengalihkan...`);
      setTimeout(() => {
        location.href = `/admin/orders/${data.order_number}`;
      }, 1000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy("");
    }
  }

  async function handleDelete() {
    if (!confirm(`HAPUS PESANAN PERMANEN?\n\nApakah Anda yakin ingin menghapus pesanan ${number} secara permanen?\n(Fitur ini hanya dapat dijalankan pada mode development)`)) {
      return;
    }
    setBusy("delete");
    setMessage("");

    try {
      const response = await fetch(`${baseApiUrl}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghapus pesanan.");

      setMessage(`Pesanan ${number} berhasil dihapus! Mengalihkan ke daftar pesanan...`);
      setTimeout(() => {
        location.href = "/admin/orders";
      }, 1000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy("");
    }
  }

  if (process.env.NEXT_PUBLIC_APP_MODE === "production" || process.env.APP_MODE === "production") {
    return null;
  }

  return (
    <details className="developer-tools">
      <summary className="developer-tools-title">Alat simulasi developer</summary>
      <div className="developer-tools-body" aria-busy={Boolean(busy)}>
        <p className="developer-tools-warning" role="note">
          Simulasi ini mengubah data pesanan, stok, pembayaran, atau pengiriman yang tersimpan. Gunakan hanya untuk pengujian terkontrol.
        </p>
        <dl className="developer-tools-context">
          <div><dt>Status saat ini</dt><dd>{fulfillmentState}</dd></div>
          <div><dt>Penanda masalah</dt><dd>{issueOrder ? "Aktif" : "Tidak aktif"}</dd></div>
        </dl>

        <div className="developer-tools-row">
          <form onSubmit={handleSimulate} className="developer-status-form">
            <label className="field">
              <span>Paksa atau simulasi status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
              <optgroup label="Status Pesanan (Fulfillment State)">
                <option value="awaiting_processing">Perlu Diproses (Awaiting Processing)</option>
                <option value="processing">Sedang Diproses (Processing)</option>
                <option value="packed">Sudah Dikemas (Packed)</option>
                <option value="handover_pending">Menunggu Pickup (Handover Pending)</option>
                <option value="handed_over">Diserahkan ke Kurir (Handed Over)</option>
                <option value="completed">Selesai (Completed)</option>
                <option value="cancelled">Dibatalkan (Cancelled)</option>
                <option value="returned">Retur Selesai (Returned)</option>
              </optgroup>

              <optgroup label="Simulasi Webhook Biteship">
                <option value="biteship_confirmed">Biteship: Pengiriman Dikonfirmasi (confirmed)</option>
                <option value="biteship_allocated">Biteship: Kurir Dialokasikan (allocated)</option>
                <option value="biteship_picking_up">Biteship: Kurir OTW Pickup (picking_up)</option>
                <option value="biteship_picked">Biteship: Paket Dijemput (picked)</option>
                <option value="biteship_in_transit">Biteship: Dalam Perjalanan (in_transit)</option>
                <option value="biteship_dropping_off">Biteship: Sedang Diantar (dropping_off)</option>
                <option value="biteship_delivered">Biteship: Paket Diterima (delivered)</option>
                <option value="biteship_on_hold">Biteship: Pengiriman Ditahan (on_hold)</option>
                <option value="biteship_rejected">Biteship: Pengiriman Ditolak (rejected) ⚠️</option>
                <option value="biteship_courier_not_found">Biteship: Kurir Tak Ditemukan (courier_not_found) ⚠️</option>
                <option value="biteship_disposed">Biteship: Paket Dimusnahkan (disposed) ⚠️</option>
                <option value="biteship_return_in_transit">Biteship: Retur OTW Kembali (return_in_transit) ⚠️</option>
                <option value="biteship_returned">Biteship: Retur Diterima Kembali (returned) ⚠️</option>
              </optgroup>

              <optgroup label="Flag Masalah (Issue Order)">
                <option value="issue_true">Tandai sebagai Bermasalah (Issue = true)</option>
                <option value="issue_false">Cabut Status Bermasalah (Issue = false)</option>
              </optgroup>
              </select>
            </label>
            <button
              type="submit"
              className="button button-dark button-compact"
              disabled={!!busy}
            >
              <RefreshCw size={14} className={busy === "simulate" ? "animate-spin" : ""} />
              {busy === "simulate" ? "Mensimulasikan…" : "Kirim simulasi"}
            </button>
          </form>

          <div className="developer-duplicate-action" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-light button-compact"
              onClick={handleDuplicate}
              disabled={!!busy}
            >
              <Copy size={14} />
              {busy === "duplicate" ? "Menduplikasi…" : "Duplikasi pesanan mock"}
            </button>
            <button
              type="button"
              className="button button-danger button-compact"
              onClick={handleDelete}
              disabled={!!busy}
            >
              <Trash2 size={14} />
              {busy === "delete" ? "Menghapus…" : "Hapus pesanan (dev)"}
            </button>
          </div>
        </div>

        {message && (
          <p role={message.includes("berhasil") ? "status" : "alert"} className={`action-message ${message.includes("berhasil") ? "success" : "error"}`}>
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
