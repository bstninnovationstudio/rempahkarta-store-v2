"use client";

import React, { useState } from "react";
import Script from "next/script";
import { MapPin, Edit2, Trash2, Plus, ArrowLeft } from "lucide-react";
import { useTurnstile } from "@/components/use-turnstile";
import { errorMessage } from "@/lib/error-message";

interface Address {
  id: string;
  label: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  postalCode: string;
  areaId: string;
}

interface UserAddressesClientProps {
  initialAddresses: Address[];
  turnstileSiteKey: string;
  defaultAction?: string;
  redirectUrl?: string;
}

export function UserAddressesClient({
  initialAddresses,
  turnstileSiteKey,
  defaultAction = "list",
  redirectUrl = "",
}: UserAddressesClientProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [mode, setMode] = useState<"list" | "add" | "edit">(defaultAction === "new" ? "add" : "list");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Form Fields State
  const [label, setLabel] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [area, setArea] = useState<{ id: string; label: string; postalCode: string } | null>(null);
  
  // Area Search State
  const [areaQuery, setAreaQuery] = useState("");
  const [areaResults, setAreaResults] = useState<Array<{ id: string; name: string; postal_code: number }>>([]);
  const [searchingArea, setSearchingArea] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { containerRef, token: turnstileToken } = useTurnstile(turnstileSiteKey);

  const resetForm = () => {
    setLabel("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setAddressDetail("");
    setArea(null);
    setAreaQuery("");
    setAreaResults([]);
    setError("");
    setSuccess("");
    setEditingAddress(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setMode("add");
  };

  const handleStartEdit = (addr: Address) => {
    setError("");
    setSuccess("");
    setEditingAddress(addr);
    setLabel(addr.label);
    setContactName(addr.contactName);
    setContactPhone(addr.contactPhone);
    setContactEmail(addr.contactEmail);
    setAddressDetail(addr.address);
    const mockArea = { id: addr.areaId, label: `Kode Pos ${addr.postalCode}`, postalCode: addr.postalCode };
    setArea(mockArea);
    setAreaQuery(mockArea.label);
    setAreaResults([]);
    setMode("edit");
  };

  const handleSearchArea = async () => {
    if (areaQuery.trim().length < 3) {
      return setError("Ketik minimal 3 karakter untuk mencari kecamatan atau kode pos.");
    }
    setSearchingArea(true);
    setError("");
    setAreaResults([]);
    setArea(null);

    try {
      const token = await turnstileToken("location_search");
      const res = await fetch(`/api/locations/search?q=${encodeURIComponent(areaQuery.trim())}`, {
        headers: { "X-Turnstile-Token": token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pencarian area gagal");
      const results = (data.areas || data.data?.areas || []) as Array<{ id: string; name: string; postal_code: number }>;
      setAreaResults(results.slice(0, 8));
      if (!results.length) setError("Area tidak ditemukan. Silakan masukkan nama kecamatan atau kode pos lain.");
    } catch (e: unknown) {
      setError(errorMessage(e, "Pencarian area gagal."));
    } finally {
      setSearchingArea(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area) {
      setError("Anda wajib memilih area kecamatan/kode pos yang valid dari hasil pencarian.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");

    const payload = {
      label: label.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      address: addressDetail.trim(),
      postalCode: area.postalCode,
      areaId: area.id,
    };

    try {
      let res;
      if (mode === "add") {
        res = await fetch("/api/user/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/user/addresses/${editingAddress?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan alamat");
      }

      // Refresh list
      const fetchList = await fetch("/api/user/addresses");
      const listData = await fetchList.json();
      if (listData.addresses) {
        setAddresses(listData.addresses);
      }

      setSuccess(mode === "add" ? "Alamat baru berhasil ditambahkan." : "Alamat berhasil diperbarui.");
      
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setTimeout(() => {
          setMode("list");
          resetForm();
        }, 1200);
      }
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal memproses data alamat."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus alamat ini?")) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/addresses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus alamat");
      }

      setAddresses(current => current.filter(a => a.id !== id));
      setSuccess("Alamat berhasil dihapus.");
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal menghapus alamat."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <div className="turnstile-hidden" ref={containerRef} />

      {mode === "list" && (
        <div>
          <div className="user-content-header">
            <div>
              <h1>Buku Alamat</h1>
              <p>Kelola hingga 5 alamat pengiriman tersimpan untuk checkout cepat.</p>
            </div>
            {addresses.length < 5 && (
              <button onClick={handleStartAdd} className="button button-light">
                <Plus size={15} /> Tambah alamat
              </button>
            )}
          </div>

          {success && <div className="form-banner success">{success}</div>}
          {error && <div className="login-error">{error}</div>}

          {addresses.length > 0 ? (
            <div className="address-list-grid">
              {addresses.map(addr => (
                <div key={addr.id} className="address-card">
                  <span className="address-card-badge">{addr.label}</span>
                  <div className="address-card-details">
                    <h4>{addr.contactName}</h4>
                    <p>{addr.address}</p>
                    <span>Kodepos: {addr.postalCode}</span>
                    <span>Telp: {addr.contactPhone}</span>
                    <span>Email: {addr.contactEmail}</span>
                  </div>
                  <div className="address-card-actions">
                    <button onClick={() => handleStartEdit(addr)} className="address-action-btn">
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(addr.id)} className="address-action-btn delete">
                      <Trash2 size={13} /> Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state address-empty-state">
              <MapPin size={32} />
              <p>Belum ada alamat pengiriman yang tersimpan.</p>
              <button onClick={handleStartAdd} className="button button-dark">Tambah alamat baru</button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Form */}
      {(mode === "add" || mode === "edit") && (
        <div>
          <div className="address-form-head" onClick={() => setMode("list")}>
            <ArrowLeft size={14} /> Kembali ke daftar alamat
          </div>

          <div className="user-content-header">
            <h1>{mode === "add" ? "Tambah Alamat Baru" : "Edit Alamat"}</h1>
            <p>Masukkan rincian lokasi penerima dengan lengkap untuk mempermudah kurir.</p>
          </div>

          {error && <div className="login-error">{error}</div>}
          {success && <div className="form-banner success">{success}</div>}

          <form onSubmit={handleSubmit} className="address-form-grid">
            <div className="address-form-row">
              <div className="field">
                <label htmlFor="label">Label Alamat (misal: Rumah, Kantor)</label>
                <input
                  id="label"
                  type="text"
                  required
                  placeholder="Rumah"
                  maxLength={80}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="contactName">Nama Penerima</label>
                <input
                  id="contactName"
                  type="text"
                  required
                  placeholder="Budi Santoso"
                  maxLength={160}
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                />
              </div>
            </div>

            <div className="address-form-row">
              <div className="field">
                <label htmlFor="contactPhone">Nomor WhatsApp Penerima</label>
                <input
                  id="contactPhone"
                  type="text"
                  required
                  pattern="[0-9+() -]{8,20}"
                  placeholder="0812 3456 7890"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="contactEmail">Email Penerima</label>
                <input
                  id="contactEmail"
                  type="email"
                  required
                  placeholder="budi@email.com"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="field full">
              <label htmlFor="area-search">Kecamatan atau Kode Pos</label>
              <div className="search-field">
                <input
                  id="area-search"
                  type="text"
                  placeholder="Cari kecamatan atau kode pos"
                  value={areaQuery}
                  onChange={e => {
                    setAreaQuery(e.target.value);
                    setArea(null);
                    setAreaResults([]);
                  }}
                />
                <button
                  type="button"
                  className="button button-light"
                  onClick={handleSearchArea}
                  disabled={searchingArea}
                >
                  {searchingArea ? "Mencari…" : "Cari"}
                </button>
              </div>
              {areaResults.length > 0 && (
                <div className="area-results static address-area-results">
                  {areaResults.map(res => (
                    <button
                      type="button"
                      key={res.id}
                      onClick={() => {
                        setArea({ id: res.id, label: `${res.name} — ${res.postal_code}`, postalCode: String(res.postal_code) });
                        setAreaQuery(`${res.name} — ${res.postal_code}`);
                        setAreaResults([]);
                      }}
                    >
                      {res.name} · {res.postal_code}
                    </button>
                  ))}
                </div>
              )}
              {area && <small className="selected-hint">Terpilih: {area.label}</small>}
            </div>

            <div className="field full">
              <label htmlFor="address-detail">Alamat Lengkap (Jalan, No Rumah, RT/RW, Patokan)</label>
              <textarea
                id="address-detail"
                required
                minLength={10}
                maxLength={1000}
                placeholder="Nama jalan, nomor rumah, RT/RW, patokan"
                value={addressDetail}
                onChange={e => setAddressDetail(e.target.value)}
              />
            </div>

            <button type="submit" className="button button-dark address-submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan alamat"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
