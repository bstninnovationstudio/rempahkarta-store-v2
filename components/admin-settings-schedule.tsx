"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Wrench,

  ShieldCheck,
  AlertCircle,
  Clock,
  Loader2,
  XCircle,
  Plus,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { formatWibDateTime } from "@/lib/store-schedule";

type ScheduleType = "HOLIDAY" | "MAINTENANCE";
type ScheduleStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

interface StoreScheduleItem {
  id: string;
  type: ScheduleType;
  title: string;
  announcement: string;
  startAt: string;
  endAt: string;
  status: ScheduleStatus;
  createdBy: string;
  createdAt: string;
}

interface OperationalStatusData {
  isHoliday: boolean;
  isMaintenance: boolean;
  activeSchedule: {
    id: string;
    type: ScheduleType;
    title: string;
    announcement: string;
    startAt: string;
    endAt: string;
  } | null;
  holidayEndAtWib: string | null;
  maintenanceEndAtWib: string | null;
  announcement: string | null;
}

interface AdminSettingsScheduleProps {
  initialStatus: OperationalStatusData;
  initialSchedules: StoreScheduleItem[];
}

export function AdminSettingsSchedule({
  initialStatus,
  initialSchedules,
}: AdminSettingsScheduleProps) {
  const router = useRouter();
  const [operationalStatus, setOperationalStatus] =
    useState<OperationalStatusData>(initialStatus);
  const [schedules, setSchedules] =
    useState<StoreScheduleItem[]>(initialSchedules);

  // Form State
  const [type, setType] = useState<ScheduleType>("HOLIDAY");
  const [title, setTitle] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function defaultAnnouncementText(scheduleType: ScheduleType) {
    if (scheduleType === "HOLIDAY") {
      return "📢 Pengumuman Operasional: Toko sedang libur. Pesanan tetap dapat dibuat dan akan kami proses serta kirimkan secara bertahap setelah masa libur berakhir.";
    }
    return "🛠️ Pemeliharaan Sistem: Toko kami sedang dalam peningkatan kualitas layanan. Fitur transaksi pengguna dijeda sementara.";
  }

  const handleTypeChange = (newType: ScheduleType) => {
    setType(newType);
    if (!announcement || announcement === defaultAnnouncementText(type)) {
      setAnnouncement(defaultAnnouncementText(newType));
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt || !endAt) {
      setError("Mohon lengkapi judul, waktu mulai, dan waktu berakhir.");
      return;
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (startDate >= endDate) {
      setError(
        "Waktu berakhir jadwal operasional harus lebih baru daripada waktu mulai."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/settings/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          announcement: announcement.trim() || defaultAnnouncementText(type),
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan jadwal operasional");
      }

      setSuccess(
        `Jadwal ${
          type === "HOLIDAY" ? "Libur" : "Maintenance"
        } ("${data.schedule.title}") berhasil ditambahkan.`
      );
      setTitle("");
      setAnnouncement("");
      setStartAt("");
      setEndAt("");
      setOperationalStatus(data.currentOperationalStatus);
      setSchedules((prev) => [data.schedule, ...prev]);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan jadwal operasional"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    setCancellingId(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/settings/schedules/${id}/cancel`, {
        method: "PATCH",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membatalkan jadwal operasional");
      }

      setSuccess("Jadwal operasional berhasil dibatalkan.");
      setOperationalStatus(data.currentOperationalStatus);
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "CANCELLED" as ScheduleStatus }
            : item
        )
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan jadwal");
    } finally {
      setCancellingId(null);
    }
  };

  function renderStatusBadge(item: StoreScheduleItem) {
    if (item.status === "ACTIVE") {
      return <span className="status-pill status-paid">Sedang Aktif</span>;
    }
    if (item.status === "SCHEDULED") {
      return <span className="status-pill status-pending">Dijadwalkan</span>;
    }
    if (item.status === "COMPLETED") {
      return <span className="status-pill status-finished">Selesai</span>;
    }
    return <span className="status-pill status-cancelled">Dibatalkan</span>;
  }

  return (
    <div className="admin-settings-schedule-container">
      {/* 1. Real-time Status Overview Banner Card */}
      <section className="admin-card op-status-card">
        <div className="op-status-header">
          <div className="op-status-title-group">
            <span className="op-status-icon-wrap">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <span className="op-status-label">Status Operasional Real-Time</span>
              <h2 className="op-status-heading">Status Toko Saat Ini</h2>
            </div>
          </div>
          <div className="op-mode-pill-wrap">
            {operationalStatus.isHoliday && (
              <div className="op-mode-pill holiday">
                <Megaphone size={15} aria-hidden="true" />
                <span>Mode Libur Aktif</span>
              </div>
            )}
            {operationalStatus.isMaintenance && (
              <div className="op-mode-pill maintenance">
                <Wrench size={15} aria-hidden="true" />
                <span>Mode Maintenance Aktif</span>
              </div>
            )}
            {!operationalStatus.isHoliday && !operationalStatus.isMaintenance && (
              <div className="op-mode-pill normal">
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>Normal (Toko Buka)</span>
              </div>
            )}
          </div>
        </div>

        <div className="op-status-body">
          {operationalStatus.activeSchedule ? (
            <div className="op-active-box">
              <div className="op-active-head">
                <div className="op-active-title">
                  <Sparkles size={16} className="text-accent" aria-hidden="true" />
                  <strong>{operationalStatus.activeSchedule.title}</strong>
                </div>
                <div className="op-active-time">
                  <Clock size={14} aria-hidden="true" />
                  <span>
                    {formatWibDateTime(operationalStatus.activeSchedule.startAt)} s/d{" "}
                    {formatWibDateTime(operationalStatus.activeSchedule.endAt)}
                  </span>
                </div>
              </div>
              <p className="op-active-announcement">
                &quot;
                {operationalStatus.announcement ||
                  operationalStatus.activeSchedule.announcement}
                &quot;
              </p>
            </div>
          ) : (
            <div className="op-normal-box">
              <p>
                Toko beroperasi secara normal tanpa batasan jadwal libur maupun pemeliharaan sistem. Seluruh pelanggan dapat berbelanja dan melakukan checkout.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Notifications / Feedback Toasts */}
      {error && (
        <div className="op-feedback-toast error" role="alert">
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="op-feedback-toast success" role="status">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {/* 2. New Operational Schedule Form Card */}
      <section className="admin-card op-form-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">Penjadwalan Otomatis</span>
            <h2>Tambah Jadwal Operasional Baru</h2>
            <p className="sub">
              Pilih mode libur atau pemeliharaan, tentukan rentang waktu WIB, dan buat pengumuman toko.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateSchedule} className="op-form">
          {/* Mode Selector Tabs */}
          <div className="op-type-tabs" role="radiogroup" aria-label="Tipe Jadwal Operasional">
            <button
              type="button"
              role="radio"
              aria-checked={type === "HOLIDAY"}
              className={`op-type-tab ${type === "HOLIDAY" ? "active" : ""}`}
              onClick={() => handleTypeChange("HOLIDAY")}
            >
              <div className="op-tab-icon holiday">
                <Megaphone size={18} aria-hidden="true" />
              </div>
              <div className="op-tab-text">
                <strong>Mode Libur Toko</strong>
                <span>Toko tetap buka untuk checkout, terdapat pengingat jadwal kirim</span>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={type === "MAINTENANCE"}
              className={`op-type-tab ${type === "MAINTENANCE" ? "active" : ""}`}
              onClick={() => handleTypeChange("MAINTENANCE")}
            >
              <div className="op-tab-icon maintenance">
                <Wrench size={18} aria-hidden="true" />
              </div>
              <div className="op-tab-text">
                <strong>Mode Pemeliharaan (Maintenance)</strong>
                <span>Akses transaksi pengguna diblokir total, admin panel tetap buka</span>
              </div>
            </button>
          </div>

          {/* Form Fields Grid */}
          <div className="op-field-grid">
            <div className="op-field-group full-width">
              <label htmlFor="schedule-title" className="op-label">
                Judul Jadwal Operasional <span className="req">*</span>
              </label>
              <input
                id="schedule-title"
                type="text"
                required
                placeholder={
                  type === "HOLIDAY"
                    ? "Contoh: Libur Hari Raya Idul Fitri 2026"
                    : "Contoh: Pemeliharaan Server Rutin Batch 3"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="op-input"
              />
            </div>

            <div className="op-field-group">
              <label htmlFor="schedule-start" className="op-label">
                Tanggal & Waktu Mulai (WIB) <span className="req">*</span>
              </label>
              <input
                id="schedule-start"
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="op-input"
              />
            </div>

            <div className="op-field-group">
              <label htmlFor="schedule-end" className="op-label">
                Tanggal & Waktu Selesai (WIB) <span className="req">*</span>
              </label>
              <input
                id="schedule-end"
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="op-input"
              />
            </div>

            <div className="op-field-group full-width">
              <label htmlFor="schedule-announcement" className="op-label">
                Teks Pengumuman (Running Text Banner Toko) <span className="req">*</span>
              </label>
              <textarea
                id="schedule-announcement"
                rows={3}
                required
                placeholder="Tuliskan pesan pengumuman yang ditampilkan pada toko..."
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                className="op-textarea"
              />
              <span className="op-hint">
                Pesan ini akan ditampilkan sebagai banner pengumuman berjalan (*running text marquee*) di bagian paling atas toko.
              </span>
            </div>
          </div>

          <div className="op-form-footer">
            <button
              type="submit"
              disabled={loading}
              className="button button-dark op-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Plus size={16} aria-hidden="true" />
                  <span>Simpan & Terapkan Jadwal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Schedule Logs & History Table Card */}
      <section className="table-card op-table-card">
        <div className="admin-card-head">
          <div>
            <span className="eyebrow">Riwayat Operasional</span>
            <h2>Log Histori & Jadwal Operasional</h2>
            <p className="sub">
              Daftar seluruh jadwal libur dan maintenance yang terdaftar beserta status pelaksanaannya.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap" role="region" aria-label="Riwayat Jadwal Operasional" tabIndex={0}>
          <table className="admin-table op-table">
            <thead>
              <tr>
                <th scope="col">Tipe & Judul</th>
                <th scope="col">Pengumuman (Running Text)</th>
                <th scope="col">Rentang Waktu (WIB)</th>
                <th scope="col">Status</th>
                <th scope="col">Dibuat Oleh</th>
                <th scope="col" className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((item) => (
                <tr key={item.id}>
                  <td data-label="Tipe & Judul" className="admin-table-cell-wrap">
                    <div className="op-table-title-cell">
                      <span className={`op-tag ${item.type.toLowerCase()}`}>
                        {item.type === "HOLIDAY" ? "Libur" : "Maintenance"}
                      </span>
                      <strong className="op-table-title">{item.title}</strong>
                    </div>
                  </td>
                  <td data-label="Pengumuman">
                    <span className="op-table-announcement">&quot;{item.announcement}&quot;</span>
                  </td>
                  <td data-label="Rentang Waktu">
                    <div className="op-table-time-cell">
                      <span>Mulai: {formatWibDateTime(item.startAt)}</span>
                      <span>Selesai: {formatWibDateTime(item.endAt)}</span>
                    </div>
                  </td>
                  <td data-label="Status">{renderStatusBadge(item)}</td>
                  <td data-label="Dibuat Oleh">
                    <span className="sub">{item.createdBy}</span>
                  </td>
                  <td data-label="Aksi" className="text-right">
                    {(item.status === "SCHEDULED" || item.status === "ACTIVE") && (
                      <button
                        type="button"
                        disabled={cancellingId === item.id}
                        onClick={() => handleCancelSchedule(item.id)}
                        className="button-link-danger op-cancel-btn"
                        title="Batalkan Jadwal Operasional"
                      >
                        {cancellingId === item.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <XCircle size={14} aria-hidden="true" />
                            <span>Batalkan</span>
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty-state">
                    Belum ada riwayat jadwal libur atau maintenance yang terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
