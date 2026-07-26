"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, PauseCircle, Ban, Loader2, X, AlertCircle } from "lucide-react";

type UserStatus = "ACTIVE" | "PAUSE" | "BLOCK";

interface AdminUserStatusControlProps {
  userId: string;
  initialStatus: UserStatus;
}

export function AdminUserStatusControl({ userId, initialStatus }: AdminUserStatusControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<UserStatus>(initialStatus);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdateStatus = async (targetStatus: UserStatus) => {
    if (targetStatus === status) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah status pengguna");
      }

      setStatus(targetStatus);
      setPendingStatus(null);
      setSuccess(`Status pelanggan berhasil diubah menjadi ${statusLabel(targetStatus)}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status");
    } finally {
      setLoading(false);
    }
  };

  function statusLabel(s: UserStatus) {
    if (s === "ACTIVE") return "Aktif";
    if (s === "PAUSE") return "Dijeda";
    return "Diblokir";
  }

  function getBadgeClass(s: UserStatus) {
    if (s === "ACTIVE") return "user-status-badge active";
    if (s === "PAUSE") return "user-status-badge pause";
    return "user-status-badge block";
  }

  return (
    <div className="user-status-control-box">
      <div className="status-control-bar">
        <span className={getBadgeClass(status)}>
          {status === "ACTIVE" && <ShieldCheck size={14} aria-hidden="true" />}
          {status === "PAUSE" && <PauseCircle size={14} aria-hidden="true" />}
          {status === "BLOCK" && <Ban size={14} aria-hidden="true" />}
          {statusLabel(status)}
        </span>

        <div className="status-control-actions" role="group" aria-label="Ubah Status Pelanggan">
          <button
            type="button"
            title="Aktifkan Akun"
            aria-label="Aktifkan Akun"
            disabled={loading || status === "ACTIVE"}
            onClick={() => setPendingStatus("ACTIVE")}
            className={`button-status-icon opt-active ${status === "ACTIVE" ? "selected" : ""}`}
          >
            <ShieldCheck size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Jeda Akun (Pause)"
            aria-label="Jeda Akun (Pause)"
            disabled={loading || status === "PAUSE"}
            onClick={() => setPendingStatus("PAUSE")}
            className={`button-status-icon opt-pause ${status === "PAUSE" ? "selected" : ""}`}
          >
            <PauseCircle size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Blokir Akun (Block)"
            aria-label="Blokir Akun (Block)"
            disabled={loading || status === "BLOCK"}
            onClick={() => setPendingStatus("BLOCK")}
            className={`button-status-icon opt-block ${status === "BLOCK" ? "selected" : ""}`}
          >
            <Ban size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {success && (
        <div className={`status-control-success-toast ${status.toLowerCase()}`}>
          {status === "ACTIVE" && <ShieldCheck size={14} aria-hidden="true" />}
          {status === "PAUSE" && <PauseCircle size={14} aria-hidden="true" />}
          {status === "BLOCK" && <Ban size={14} aria-hidden="true" />}
          <span>{success}</span>
        </div>
      )}

      {/* Confirmation Modal Popup */}
      {pendingStatus && (
        <div className="status-popup-backdrop" onClick={() => !loading && setPendingStatus(null)}>
          <div className="status-popup-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="status-modal-title">
            <div className="status-popup-header">
              <div className={`status-popup-icon-wrap ${pendingStatus.toLowerCase()}`}>
                {pendingStatus === "ACTIVE" && <ShieldCheck size={22} aria-hidden="true" />}
                {pendingStatus === "PAUSE" && <PauseCircle size={22} aria-hidden="true" />}
                {pendingStatus === "BLOCK" && <Ban size={22} aria-hidden="true" />}
              </div>
              <button
                type="button"
                className="status-popup-close"
                onClick={() => setPendingStatus(null)}
                disabled={loading}
                aria-label="Tutup konfirmasi"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="status-popup-body">
              <h3 id="status-modal-title">Konfirmasi Ubah Status</h3>
              <p>
                Ubah status akun pelanggan dari <strong>{statusLabel(status)}</strong> menjadi{" "}
                <strong>{statusLabel(pendingStatus)}</strong>?
              </p>

              {pendingStatus === "PAUSE" && (
                <div className="status-popup-alert warning">
                  <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                  <span>
                    Pelanggan masih dapat melihat pantauan pesanan & dashboard, namun <strong>TIDAK BISA</strong> membuat pesanan baru, mengedit profil/alamat/rekening, atau mengajukan pembatalan/retur.
                  </span>
                </div>
              )}

              {pendingStatus === "BLOCK" && (
                <div className="status-popup-alert danger">
                  <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                  <span>
                    Pelanggan akan <strong>DIBLOKIR TOTAL</strong> dan tidak dapat melakukan login Google atau mengakses API/dashboard pengguna sama sekali.
                  </span>
                </div>
              )}

              {error && <p className="status-control-error">{error}</p>}
            </div>

            <div className="status-popup-actions">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPendingStatus(null)}
                className="button button-light"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleUpdateStatus(pendingStatus)}
                className={`button ${pendingStatus === "BLOCK" ? "button-danger" : "button-dark"}`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Ya, Ubah Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
