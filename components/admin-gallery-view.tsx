"use client";

import Image from "next/image";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  FileImage,
  HardDrive,
  Info,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import type { MediaCategory, MediaItem } from "@/lib/admin-media";

type Props = {
  initialData: {
    items: MediaItem[];
    stats: {
      totalCount: number;
      totalSizeFormatted: string;
      unusedCount: number;
      unusedSizeFormatted: string;
    };
  };
};

type SortOption = "newest" | "oldest" | "size_desc" | "size_asc" | "name_asc";
type ViewMode = "grid" | "list";

export function AdminGalleryView({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | MediaCategory | "unused">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modal states
  const [targetItem, setTargetItem] = useState<MediaItem | null>(null);
  const [confirmUsedChecked, setConfirmUsedChecked] = useState(false);
  const [clearUnusedModalOpen, setClearUnusedModalOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function refreshGallery() {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/media");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      setStatusMessage({ type: "error", text: "Gagal memperbarui data galeri" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSingle(force = false) {
    if (!targetItem) return;
    setActionBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_single",
          path: targetItem.relativePath,
          force,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        if (result.requiresForce) {
          setStatusMessage({
            type: "error",
            text: "File media sedang terpakai oleh data aktif. Centang konfirmasi untuk tetap menghapus.",
          });
          return;
        }
        throw new Error(result.error || "Gagal menghapus file");
      }

      setStatusMessage({
        type: "success",
        text: `Berhasil menghapus ${targetItem.fileName}`,
      });
      setTargetItem(null);
      setConfirmUsedChecked(false);
      await refreshGallery();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus file",
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleClearAllUnused() {
    setActionBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_unused" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal membersihkan sampah");

      setStatusMessage({
        type: "success",
        text: `Berhasil membersihkan ${result.deletedCount} file media sampah.`,
      });
      setClearUnusedModalOpen(false);
      await refreshGallery();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal membersihkan sampah",
      });
    } finally {
      setActionBusy(false);
    }
  }

  // Filter items
  const filteredItems = data.items.filter((item) => {
    if (activeTab === "unused") {
      if (item.isUsed) return false;
    } else if (activeTab !== "all") {
      if (item.category !== activeTab) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.fileName.toLowerCase().includes(q);
      const matchUsed = item.usedBy.some((u) => u.toLowerCase().includes(q));
      return matchName || matchUsed;
    }
    return true;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "size_desc") return b.sizeBytes - a.sizeBytes;
    if (sortBy === "size_asc") return a.sizeBytes - b.sizeBytes;
    if (sortBy === "name_asc") return a.fileName.localeCompare(b.fileName);
    if (sortBy === "oldest") return a.fileName.localeCompare(b.fileName);
    // default newest
    if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1;
    return b.fileName.localeCompare(a.fileName);
  });

  const usedCount = data.stats.totalCount - data.stats.unusedCount;

  return (
    <div className="gallery-container">
      {/* Header & Metrics */}
      <div className="gallery-metrics-grid">
        <article className="metric-card">
          <div className="metric-card-head">
            <span>Total Media</span>
            <FileImage size={16} aria-hidden="true" />
          </div>
          <strong className="admin-numeric">{data.stats.totalCount} File</strong>
          <span className="metric-trend">Total kapasitas: {data.stats.totalSizeFormatted}</span>
        </article>

        <article className="metric-card">
          <div className="metric-card-head">
            <span>Media Terpakai</span>
            <CheckCircle2 size={16} aria-hidden="true" className="tone-success" />
          </div>
          <strong className="admin-numeric">{usedCount} File</strong>
          <span className="metric-trend tone-success">Terhubung dengan produk/resolusi</span>
        </article>

        <article className="metric-card">
          <div className="metric-card-head">
            <span>Media Sampah (Unused)</span>
            <AlertTriangle size={16} aria-hidden="true" className="tone-warning" />
          </div>
          <strong className="admin-numeric tone-danger">{data.stats.unusedCount} File</strong>
          <span className="metric-trend tone-warning">Kapasitas terbuang: {data.stats.unusedSizeFormatted}</span>
        </article>
      </div>

      {/* Action Bar & Notification */}
      {statusMessage && (
        <div className={`gallery-alert gallery-alert-${statusMessage.type}`}>
          {statusMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="gallery-alert-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Primary Toolbar */}
      <div className="gallery-toolbar-card">
        <div className="gallery-toolbar-top">
          <nav className="filter-row" aria-label="Filter kategori media">
            <button
              type="button"
              className={`filter-chip ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              Semua <b>{data.stats.totalCount}</b>
            </button>
            <button
              type="button"
              className={`filter-chip ${activeTab === "products" ? "active" : ""}`}
              onClick={() => setActiveTab("products")}
            >
              Produk <b>{data.items.filter((i) => i.category === "products").length}</b>
            </button>
            <button
              type="button"
              className={`filter-chip ${activeTab === "returns" ? "active" : ""}`}
              onClick={() => setActiveTab("returns")}
            >
              Bukti Retur <b>{data.items.filter((i) => i.category === "returns").length}</b>
            </button>
            <button
              type="button"
              className={`filter-chip ${activeTab === "refunds" ? "active" : ""}`}
              onClick={() => setActiveTab("refunds")}
            >
              Bukti Refund <b>{data.items.filter((i) => i.category === "refunds").length}</b>
            </button>
            <button
              type="button"
              className={`filter-chip filter-chip-danger ${activeTab === "unused" ? "active" : ""}`}
              onClick={() => setActiveTab("unused")}
            >
              File Sampah <b>{data.stats.unusedCount}</b>
            </button>
          </nav>

          {data.stats.unusedCount > 0 && (
            <button
              type="button"
              className="button button-danger gallery-clear-unused-btn"
              onClick={() => setClearUnusedModalOpen(true)}
            >
              <Trash2 size={15} /> Bersihkan Semua Sampah ({data.stats.unusedCount})
            </button>
          )}
        </div>

        <div className="gallery-toolbar-controls">
          <div className="gallery-search-wrap">
            <Search size={15} className="gallery-search-icon" />
            <input
              type="search"
              placeholder="Cari nama file atau rincian relasi data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="gallery-search-input"
            />
          </div>

          <div className="gallery-control-group">
            <div className="gallery-select-wrap">
              <ArrowUpDown size={14} className="gallery-select-icon" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="gallery-select-input"
                aria-label="Urutkan media"
              >
                <option value="newest">Terbaru / Sampah Dulu</option>
                <option value="oldest">Terlama</option>
                <option value="size_desc">Ukuran Terbesar</option>
                <option value="size_asc">Ukuran Terkecil</option>
                <option value="name_asc">Nama (A-Z)</option>
              </select>
            </div>

            <div className="gallery-view-toggle" aria-label="Mode tampilan">
              <button
                type="button"
                className={`gallery-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Tampilan Grid"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                className={`gallery-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Tampilan Tabel List"
              >
                <List size={15} />
              </button>
            </div>

            <button
              type="button"
              className="button button-light gallery-refresh-btn"
              onClick={refreshGallery}
              disabled={loading}
              title="Segarkan data media"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="gallery-grid">
          {sortedItems.map((item) => {
            const ext = item.fileName.split(".").pop()?.toUpperCase() || "IMG";
            return (
              <article key={item.id} className={`gallery-card ${!item.isUsed ? "gallery-card-unused" : ""}`}>
                <div className="gallery-thumb-wrap">
                  <Image
                    src={item.previewUrl}
                    alt={item.fileName}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
                    className="gallery-thumb-img"
                    unoptimized
                  />
                  <span className="gallery-ext-badge">{ext}</span>
                  <span className="gallery-category-badge">{item.categoryLabel}</span>
                </div>

                <div className="gallery-card-body">
                  <h3 className="gallery-filename" title={item.fileName}>
                    {item.fileName}
                  </h3>
                  <div className="gallery-file-meta">
                    <span>{item.sizeFormatted}</span>
                    <span>•</span>
                    <span>{item.createdAt}</span>
                  </div>

                  {/* Status Badge */}
                  <div className="gallery-status-row">
                    {item.isUsed ? (
                      <span className="status-pill status-tone-success">Terpakai</span>
                    ) : (
                      <span className="status-pill status-tone-danger">Tidak Terpakai</span>
                    )}
                  </div>

                  {/* Usage details */}
                  {item.isUsed && item.usedBy.length > 0 && (
                    <div className="gallery-usage-info">
                      <Info size={13} aria-hidden="true" className="gallery-info-icon" />
                      <span>{item.usedBy.join(" · ")}</span>
                    </div>
                  )}

                  <div className="gallery-card-actions">
                    <button
                      type="button"
                      className={`button ${item.isUsed ? "button-light" : "button-danger"} gallery-delete-btn`}
                      onClick={() => {
                        setTargetItem(item);
                        setConfirmUsedChecked(false);
                      }}
                    >
                      <Trash2 size={14} /> {item.isUsed ? "Hapus Gambar" : "Hapus Sampah"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {sortedItems.length === 0 && (
            <div className="gallery-empty-state">
              <HardDrive size={36} aria-hidden="true" />
              <h3>Tidak Ada File Media</h3>
              <p>
                {searchQuery
                  ? "Tidak ada file media yang cocok dengan kata kunci pencarian."
                  : activeTab === "unused"
                  ? "Bagus! Tidak ada file media sampah di penyimpanan server."
                  : "Belum ada file media di folder ini."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* List / Table View */}
      {viewMode === "list" && (
        <div className="table-card gallery-list-card">
          <div className="admin-table-wrap">
            <table className="admin-table gallery-table">
              <caption className="admin-table-caption">Daftar file media terdaftar di server</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: "64px" }}>Media</th>
                  <th scope="col">Nama File</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Status Penggunaan</th>
                  <th scope="col">Ukuran</th>
                  <th scope="col">Tanggal Upload</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.id} className={!item.isUsed ? "admin-issue-row" : ""}>
                    <td>
                      <div className="gallery-table-thumb">
                        <Image src={item.previewUrl} alt="" fill unoptimized />
                      </div>
                    </td>
                    <td>
                      <strong className="admin-data-code gallery-table-filename" title={item.fileName}>
                        {item.fileName}
                      </strong>
                      <span className="sub">{item.relativePath}</span>
                    </td>
                    <td>
                      <span className="gallery-table-category">{item.categoryLabel}</span>
                    </td>
                    <td>
                      {item.isUsed ? (
                        <div>
                          <span className="status-pill status-tone-success">Terpakai</span>
                          <span className="gallery-table-usage">{item.usedBy.join(" · ")}</span>
                        </div>
                      ) : (
                        <span className="status-pill status-tone-danger">Tidak Terpakai</span>
                      )}
                    </td>
                    <td>
                      <span className="admin-numeric">{item.sizeFormatted}</span>
                    </td>
                    <td>
                      <span className="sub">{item.createdAt}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`button ${item.isUsed ? "button-light" : "button-danger"} gallery-table-btn`}
                        onClick={() => {
                          setTargetItem(item);
                          setConfirmUsedChecked(false);
                        }}
                      >
                        <Trash2 size={13} /> {item.isUsed ? "Hapus" : "Hapus Sampah"}
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      <div className="admin-table-empty-content">
                        <strong>Tidak Ada File Media</strong>
                        <span>Pilih kategori lain atau bersihkan filter pencarian.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Single Item Modal */}
      {targetItem && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content gallery-modal">
            <div className="modal-head">
              <h3>{targetItem.isUsed ? "Hapus File Terpakai (Konfirmasi Terpisah)" : "Hapus File Sampah"}</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setTargetItem(null)}
                disabled={actionBusy}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="gallery-modal-preview">
                <div className="gallery-modal-thumb">
                  <Image src={targetItem.previewUrl} alt="" fill unoptimized />
                </div>
                <div>
                  <strong className="gallery-modal-filename">{targetItem.fileName}</strong>
                  <p className="gallery-modal-meta">
                    Ukuran: {targetItem.sizeFormatted} · Kategori: {targetItem.categoryLabel}
                  </p>
                </div>
              </div>

              {/* Special warning & double confirmation if item is used */}
              {targetItem.isUsed ? (
                <div className="gallery-danger-box">
                  <div className="gallery-danger-box-head">
                    <ShieldAlert size={18} />
                    <strong>PERHATIAN SANGAT PENTING: FILE SEDANG TERPAKAI!</strong>
                  </div>
                  <p>
                    File media ini saat ini terhubung di database dengan data berikut:
                  </p>
                  <ul className="gallery-usage-list">
                    {targetItem.usedBy.map((usage) => (
                      <li key={usage}>{usage}</li>
                    ))}
                  </ul>
                  <p className="gallery-warning-note">
                    Menghapus file ini akan melepas keterhubungan record gambar di database dan menghapus file secara permanen dari server.
                  </p>

                  <label className="gallery-checkbox-label">
                    <input
                      type="checkbox"
                      checked={confirmUsedChecked}
                      onChange={(e) => setConfirmUsedChecked(e.target.checked)}
                    />
                    <span>Saya mengerti risiko ini dan mengonfirmasi tetap menghapus gambar terpakai ini.</span>
                  </label>
                </div>
              ) : (
                <p className="gallery-confirm-text">
                  Apakah Anda yakin ingin menghapus file sampah <strong>{targetItem.fileName}</strong> ({targetItem.sizeFormatted}) ini secara permanen dari server?
                </p>
              )}
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="button button-light"
                onClick={() => setTargetItem(null)}
                disabled={actionBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={actionBusy || (targetItem.isUsed && !confirmUsedChecked)}
                onClick={() => handleDeleteSingle(targetItem.isUsed)}
              >
                {actionBusy ? "Menghapus..." : targetItem.isUsed ? "Paksa Hapus" : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Unused Modal */}
      {clearUnusedModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content gallery-modal">
            <div className="modal-head">
              <h3>Bersihkan Semua File Sampah</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setClearUnusedModalOpen(false)}
                disabled={actionBusy}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="gallery-danger-box">
                <div className="gallery-danger-box-head">
                  <AlertTriangle size={18} />
                  <strong>Konfirmasi Hapus Massal File Sampah</strong>
                </div>
                <p>
                  Sistem akan menghapus <strong>{data.stats.unusedCount} file media</strong> ({data.stats.unusedSizeFormatted}) yang tidak lagi dirujuk atau digunakan di database.
                </p>
                <p className="gallery-warning-note">
                  File yang terpakai oleh produk atau resolusi retur/refund <strong>TIDAK akan tersentuh</strong> dan tetap aman.
                </p>
              </div>
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="button button-light"
                onClick={() => setClearUnusedModalOpen(false)}
                disabled={actionBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={actionBusy}
                onClick={handleClearAllUnused}
              >
                {actionBusy ? "Membersihkan..." : `Hapus ${data.stats.unusedCount} File Sampah`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
