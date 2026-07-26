"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Truck,
  User,
  X,
} from "lucide-react";
import type { CourierOption, WarehousePayload } from "@/lib/admin-shipping-config";

type LocationResult = {
  id: string;
  name: string;
  postal_code: number;
  administrative_division_level_1_name: string;
  administrative_division_level_2_name: string;
  administrative_division_level_3_name: string;
  administrative_division_level_4_name: string;
};

type Props = {
  initialConfig: {
    enabledCouriers: string[];
    couriers: CourierOption[];
    warehouse: WarehousePayload;
  };
};

export function AdminShippingView({ initialConfig }: Props) {
  const [couriers, setCouriers] = useState<CourierOption[]>(initialConfig.couriers);
  const [warehouse, setWarehouse] = useState<WarehousePayload>(initialConfig.warehouse);

  // Per-courier loading state
  const [togglingCourier, setTogglingCourier] = useState<string | null>(null);

  // Location search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Save warehouse state
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Instant toggle for courier
  async function handleToggleCourier(code: string, currentEnabled: boolean) {
    const nextState = !currentEnabled;
    setTogglingCourier(code);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/shipping/couriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enabled: nextState }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status kurir");

      if (json.config) {
        setCouriers(json.config.couriers);
      }

      setStatusMessage({
        type: "success",
        text: `Ekspedisi ${code.toUpperCase()} berhasil ${nextState ? "diaktifkan" : "dinonaktifkan"} secara instan!`,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengubah status kurir",
      });
    } finally {
      setTogglingCourier(null);
    }
  }

  // Search Biteship locations
  async function handleSearchLocation() {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchError("Kata pencarian minimal 3 karakter");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setLocationResults([]);

    try {
      const res = await fetch(`/api/admin/shipping/locations?q=${encodeURIComponent(searchQuery.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mencari lokasi di Biteship");

      const areas = json.areas || [];
      if (areas.length === 0) {
        setSearchError("Lokasi tidak ditemukan di Biteship. Coba dengan nama kecamatan atau kelurahan lain.");
      } else {
        setLocationResults(areas);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Pencarian lokasi gagal");
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(loc: LocationResult) {
    setWarehouse((prev) => ({
      ...prev,
      areaId: loc.id,
      postalCode: String(loc.postal_code || prev.postalCode),
    }));
    setLocationResults([]);
    setSearchQuery("");
    setStatusMessage({
      type: "success",
      text: `Area ID terpilih: ${loc.id} (${loc.name})`,
    });
  }

  // Save warehouse form
  async function handleSaveWarehouse() {
    setSavingWarehouse(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/shipping/warehouse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warehouse),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan informasi gudang");

      setStatusMessage({
        type: "success",
        text: "Informasi gudang utama berhasil disimpan ke lingkungan (ENV) & database secara instan!",
      });

      if (json.config?.warehouse) {
        setWarehouse(json.config.warehouse);
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan gudang",
      });
    } finally {
      setSavingWarehouse(false);
    }
  }

  const enabledCourierNames = couriers
    .filter((c) => c.enabled)
    .map((c) => c.name)
    .join(", ");

  return (
    <div className="shipping-config-container">
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`gallery-alert gallery-alert-${statusMessage.type}`}>
          {statusMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="gallery-alert-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Section 1: Layanan Kurir Ekspedisi Aktif (Instant Toggle) */}
      <section className="shipping-section-card">
        <div className="shipping-card-head">
          <div className="shipping-card-title">
            <Truck size={18} className="tone-accent" />
            <div>
              <h2>Layanan Kurir Ekspedisi Aktif</h2>
              <p>Mengatur ekspedisi kurir yang aktif di toko secara instan tanpa perlu tombol simpan manual.</p>
            </div>
          </div>
          <div className="shipping-badge-summary">
            <span>Kurir Aktif:</span>
            <strong>{couriers.filter((c) => c.enabled).length} dari {couriers.length}</strong>
          </div>
        </div>

        <div className="couriers-toggle-grid">
          {couriers.map((courier) => {
            const isBusy = togglingCourier === courier.code;
            return (
              <article
                key={courier.code}
                className={`courier-toggle-card ${courier.enabled ? "active" : ""} ${isBusy ? "busy" : ""}`}
                onClick={() => !isBusy && handleToggleCourier(courier.code, courier.enabled)}
              >
                <div className="courier-card-head">
                  <span className="courier-code-badge">{courier.code.toUpperCase()}</span>
                  {isBusy ? (
                    <RefreshCw size={14} className="spin tone-accent" />
                  ) : (
                    <label className="switch-toggle" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={courier.enabled}
                        onChange={() => handleToggleCourier(courier.code, courier.enabled)}
                      />
                      <span className="slider round"></span>
                    </label>
                  )}
                </div>

                <strong className="courier-name">{courier.name}</strong>
                <p className="courier-desc">{courier.description}</p>
              </article>
            );
          })}
        </div>

        <div className="couriers-summary-bar">
          <ShieldCheck size={15} />
          <span>Kurir aktif toko saat ini: <b>{enabledCourierNames || "Belum ada kurir aktif"}</b></span>
        </div>
      </section>

      {/* Section 2: Detail Gudang Utama Penjemputan */}
      <section className="shipping-section-card">
        <div className="shipping-card-head">
          <div className="shipping-card-title">
            <Building2 size={18} className="tone-accent" />
            <div>
              <h2>Detail Gudang Utama Penjemputan</h2>
              <p>Informasi alamat dan titik asal penjemputan paket kurir untuk perhitungan tarif Biteship.</p>
            </div>
          </div>
        </div>

        <div className="shipping-form-grid">
          <div className="form-group">
            <label htmlFor="wh-name">
              <Package size={14} /> Nama Gudang Penjemputan
            </label>
            <input
              id="wh-name"
              type="text"
              value={warehouse.name}
              onChange={(e) => setWarehouse({ ...warehouse, name: e.target.value })}
              placeholder="e.g. Gudang Utama REMPAHKARTA"
              className="admin-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="wh-contact-name">
              <User size={14} /> Nama Kontak Pengirim
            </label>
            <input
              id="wh-contact-name"
              type="text"
              value={warehouse.contactName}
              onChange={(e) => setWarehouse({ ...warehouse, contactName: e.target.value })}
              placeholder="e.g. REMPAHKARTA"
              className="admin-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="wh-contact-phone">
              <Phone size={14} /> Nomor Telepon Kontak Pengirim
            </label>
            <input
              id="wh-contact-phone"
              type="tel"
              value={warehouse.contactPhone}
              onChange={(e) => setWarehouse({ ...warehouse, contactPhone: e.target.value })}
              placeholder="e.g. 08562524627"
              className="admin-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="wh-address">
              <MapPin size={14} /> Alamat Lengkap (Jalan / RT / RW / No. Rumah)
            </label>
            <textarea
              id="wh-address"
              value={warehouse.address}
              onChange={(e) => setWarehouse({ ...warehouse, address: e.target.value })}
              placeholder="e.g. Sentolo Lor, RT 18/RW 09, Sentolo, Kulon Progo, DIY"
              rows={3}
              className="admin-textarea"
            />
          </div>

          {/* Full-width Stacked Area Box */}
          <div className="warehouse-area-box full-width">
            <div className="area-box-head">
              <MapPin size={18} className="tone-accent" />
              <div>
                <strong>Biteship Area ID & Kode Pos Gudang</strong>
                <p>Diperlukan oleh API Biteship untuk penjemputan paket kurir dan hitung tarif ongkir.</p>
              </div>
            </div>

            {/* 2-Column Badges Grid (Side-by-side 2 columns) */}
            <div className="area-id-display-grid">
              <div className="area-field-badge">
                <span>Area ID Terpasang</span>
                <strong className="admin-data-code">{warehouse.areaId}</strong>
              </div>
              <div className="area-field-badge">
                <span>Kode Pos Terpasang</span>
                <strong className="admin-data-code">{warehouse.postalCode}</strong>
              </div>
            </div>

            {/* Location Search Tool (Full-width Below Badges) */}
            <div className="area-search-tool">
              <label htmlFor="area-search-input">Cari & Ganti Area ID lewat API Biteship:</label>
              <div className="area-search-input-wrap">
                <div className="search-input-field-wrap">
                  <Search size={15} className="search-input-icon" />
                  <input
                    id="area-search-input"
                    type="search"
                    placeholder="Ketik kecamatan atau kelurahan gudang (misal: Sentolo, Kulon Progo)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchLocation();
                      }
                    }}
                    className="admin-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchLocation}
                  disabled={searching}
                  className="button button-accent area-search-btn"
                >
                  {searching ? <RefreshCw size={14} className="spin" /> : <Search size={14} />} Cari Lokasi
                </button>
              </div>

              {searchError && <p className="area-search-error">{searchError}</p>}

              {/* Location Search Results List */}
              {locationResults.length > 0 && (
                <div className="area-results-list">
                  <div className="results-list-head">
                    <span>Ditemukan {locationResults.length} area dari Biteship:</span>
                    <button
                      type="button"
                      onClick={() => setLocationResults([])}
                      className="results-close-btn"
                      title="Tutup"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <ul>
                    {locationResults.map((loc) => (
                      <li key={loc.id} onClick={() => selectLocation(loc)}>
                        <div className="loc-info-main">
                          <strong className="loc-title">{loc.name}</strong>
                          <span className="loc-sub">
                            {loc.administrative_division_level_3_name}, {loc.administrative_division_level_2_name}, {loc.administrative_division_level_1_name} ({loc.postal_code})
                          </span>
                        </div>
                        <div className="loc-action-row">
                          <div className="area-id-chip-wrap">
                            <span className="chip-label">Area ID:</span>
                            <code className="area-id-chip">{loc.id}</code>
                          </div>
                          <button type="button" className="button button-accent button-sm select-area-btn">
                            Pilih Area Ini
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section Save Button for Warehouse */}
        <div className="warehouse-save-foot">
          <button
            type="button"
            onClick={handleSaveWarehouse}
            disabled={savingWarehouse}
            className="button button-accent warehouse-save-btn"
          >
            {savingWarehouse ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
            {savingWarehouse ? "Menyimpan Gudang..." : "Simpan Informasi Gudang Utama"}
          </button>
        </div>
      </section>
    </div>
  );
}
