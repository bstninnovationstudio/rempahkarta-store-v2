"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { MapPin, Edit2, Trash2, Plus, ArrowLeft, CheckCircle2, Star } from "lucide-react";
import { useTurnstile } from "@/components/use-turnstile";
import { errorMessage } from "@/lib/error-message";
import { safeInternalPath } from "@/lib/safe-redirect";
import { useRouter } from "next/navigation";

interface Address {
  id: string;
  label: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  postalCode: string;
  areaId: string;
  isDefault?: boolean;
}

interface UserAddressesClientProps {
  initialAddresses: Address[];
  turnstileSiteKey: string;
  defaultAction?: string;
  redirectUrl?: string;
  embedded?: boolean;
  isComplete?: boolean;
  defaultContact?: {
    name: string;
    phone: string;
    email: string;
  };
}

export function UserAddressesClient({
  initialAddresses,
  turnstileSiteKey,
  defaultAction = "list",
  redirectUrl = "",
  embedded = false,
  isComplete = false,
  defaultContact,
}: UserAddressesClientProps) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [mode, setMode] = useState<"list" | "add" | "edit">(defaultAction === "new" ? "add" : "list");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Form Fields State
  const [label, setLabel] = useState("");
  const [contactName, setContactName] = useState(defaultContact?.name || "");
  const [contactPhone, setContactPhone] = useState(defaultContact?.phone || "");
  const [contactEmail, setContactEmail] = useState(defaultContact?.email || "");
  const [addressDetail, setAddressDetail] = useState("");
  const [area, setArea] = useState<{ id: string; label: string; postalCode: string } | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  
  // Area Search State
  const [areaQuery, setAreaQuery] = useState("");
  const [areaResults, setAreaResults] = useState<Array<{ id: string; name: string; postal_code: number }>>([]);
  const [searchingArea, setSearchingArea] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreListFocusRef = useRef(false);

  const { containerRef, token: turnstileToken } = useTurnstile(turnstileSiteKey);

  useEffect(() => {
    if (mode === "add" || mode === "edit") {
      firstFieldRef.current?.focus();
      return;
    }
    if (restoreListFocusRef.current) {
      restoreListFocusRef.current = false;
      listHeadingRef.current?.focus();
    }
  }, [mode]);

  const resetForm = (useContactDefaults = false) => {
    setLabel("");
    setContactName(useContactDefaults ? defaultContact?.name || "" : "");
    setContactPhone(useContactDefaults ? defaultContact?.phone || "" : "");
    setContactEmail(useContactDefaults ? defaultContact?.email || "" : "");
    setAddressDetail("");
    setArea(null);
    setAreaQuery("");
    setAreaResults([]);
    setIsDefault(addresses.length === 0);
    setError("");
    setSuccess("");
    setEditingAddress(null);
  };

  const handleStartAdd = () => {
    resetForm(true);
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
    setIsDefault(Boolean(addr.isDefault));
    const mockArea = { id: addr.areaId, label: `Kode Pos ${addr.postalCode}`, postalCode: addr.postalCode };
    setArea(mockArea);
    setAreaQuery(mockArea.label);
    setAreaResults([]);
    setMode("edit");
  };

  const handleReturnToList = () => {
    restoreListFocusRef.current = true;
    setMode("list");
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

  const handleSetDefault = async (id: string) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const securityToken = await turnstileToken("user_address");
      const res = await fetch(`/api/user/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: securityToken }),
      });
      const text = await res.text();
      if (!text) throw new Error(`Server tidak mengembalikan respons (${res.status}).`);
      let data: { error?: string; success?: boolean } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Respons server tidak valid (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui alamat utama");

      setAddresses((current) =>
        current
          .map((a) => ({
            ...a,
            isDefault: a.id === id,
          }))
          .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
      );
      setSuccess("Alamat utama berhasil diperbarui.");
      router.refresh();
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal memperbarui alamat utama."));
    } finally {
      setBusy(false);
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
      isDefault,
    };

    try {
      const securityToken = await turnstileToken("user_address");
      let res;
      if (mode === "add") {
        res = await fetch("/api/user/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, turnstileToken: securityToken }),
        });
      } else {
        res = await fetch(`/api/user/addresses/${editingAddress?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, turnstileToken: securityToken }),
        });
      }

      const text = await res.text();
      if (!text) throw new Error(`Server tidak mengembalikan respons (${res.status}).`);
      let data: { error?: string; address?: Address } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Respons server tidak valid (${res.status}).`);
      }
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan alamat");
      }

      if (data.address) {
        const saved = data.address as Address;
        setAddresses((current) => {
          let updatedList = mode === "add"
            ? [saved, ...current]
            : current.map((a) => a.id === saved.id ? saved : a);
          if (saved.isDefault) {
            updatedList = updatedList.map((a) => a.id === saved.id ? saved : { ...a, isDefault: false });
          }
          return updatedList.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        });
      }
      router.refresh();

      setSuccess(mode === "add" ? "Alamat baru berhasil ditambahkan." : "Alamat berhasil diperbarui.");
      
      const safeRedirect = safeInternalPath(redirectUrl, "");
      if (safeRedirect) {
        window.location.href = safeRedirect;
      } else {
        setTimeout(() => {
          restoreListFocusRef.current = true;
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
      const securityToken = await turnstileToken("user_address");
      const res = await fetch(`/api/user/addresses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: securityToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus alamat");
      }

      setAddresses((current) => {
        const deletedAddr = current.find((a) => a.id === id);
        const filtered = current.filter((a) => a.id !== id);
        if (deletedAddr?.isDefault && filtered.length > 0) {
          filtered[0].isDefault = true;
        }
        return filtered;
      });
      setSuccess("Alamat berhasil dihapus.");
      router.refresh();
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
        <section id="addresses" className={embedded ? "account-settings-section" : undefined} aria-labelledby="address-settings-title">
          <div className={embedded ? "account-settings-section-head account-settings-section-head-actions" : "user-content-header"}>
            {embedded && <span className="account-settings-icon"><MapPin size={19} aria-hidden="true" /></span>}
            <div>
              <div className={embedded ? "account-settings-title-row" : undefined}>
                {embedded
                  ? <h2 ref={listHeadingRef} tabIndex={-1} id="address-settings-title">Alamat pengiriman</h2>
                  : <h1 ref={listHeadingRef} tabIndex={-1} id="address-settings-title">Buku Alamat</h1>}
                {embedded && (
                  <span className={`completion-chip ${isComplete ? "complete" : "incomplete"}`}>
                    {isComplete && <CheckCircle2 size={13} aria-hidden="true" />}
                    {isComplete ? "Lengkap" : "Minimal 1 alamat"}
                  </span>
                )}
              </div>
              <p>Kelola hingga 5 alamat pengiriman tersimpan untuk checkout cepat.</p>
            </div>
            {addresses.length < 5 && (
              <button type="button" onClick={handleStartAdd} className="button button-light account-section-add-button">
                <Plus size={15} /> Tambah alamat
              </button>
            )}
          </div>

          {success && <div className="form-banner success" role="status">{success}</div>}
          {error && <div className="form-banner error" role="alert">{error}</div>}

          {addresses.length > 0 ? (
            <div className="user-address-list-grid">
              {addresses.map((addr, index) => {
                const isAddrDefault = addr.isDefault || (!addresses.some(a => a.isDefault) && index === 0);
                return (
                  <article key={addr.id} className="user-address-card">
                    <div className="address-card-head-row">
                      <span className={`user-address-card-badge ${isAddrDefault ? "is-default" : ""}`}>
                        {addr.label} {isAddrDefault ? "• Utama" : ""}
                      </span>
                      {!isAddrDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(addr.id)}
                          className="set-default-btn"
                          disabled={busy}
                          title="Jadikan Alamat Utama"
                        >
                          <Star size={12} /> Jadikan Utama
                        </button>
                      )}
                    </div>
                  <div className="user-address-card-details">
                    <h3>{addr.contactName}</h3>
                    <p>{addr.address}</p>
                    <dl className="user-address-meta">
                      <div><dt>Kode pos</dt><dd>{addr.postalCode}</dd></div>
                      <div><dt>Telepon</dt><dd>{addr.contactPhone}</dd></div>
                      <div><dt>Email</dt><dd>{addr.contactEmail}</dd></div>
                    </dl>
                  </div>
                  <div className="user-address-card-actions">
                    <button type="button" onClick={() => handleStartEdit(addr)} className="user-address-action-btn">
                      <Edit2 size={13} /> Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(addr.id)} className="user-address-action-btn delete" disabled={busy}>
                      <Trash2 size={13} /> Hapus
                    </button>
                  </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state address-empty-state">
              <MapPin size={32} />
              <p>Belum ada alamat pengiriman yang tersimpan.</p>
              <button type="button" onClick={handleStartAdd} className="button button-dark">Tambah alamat baru</button>
            </div>
          )}
        </section>
      )}

      {/* Add / Edit Form */}
      {(mode === "add" || mode === "edit") && (
        <section id="addresses" className={embedded ? "account-settings-section" : undefined} aria-labelledby="address-form-title">
          <button type="button" className="address-form-head" onClick={handleReturnToList}>
            <ArrowLeft size={14} /> Kembali ke daftar alamat
          </button>

          <div className={embedded ? "account-settings-section-head account-settings-section-head-actions" : "user-content-header"}>
            {embedded && <span className="account-settings-icon"><MapPin size={19} aria-hidden="true" /></span>}
            <div>
              {embedded
                ? <h2 id="address-form-title">{mode === "add" ? "Tambah alamat baru" : "Edit alamat"}</h2>
                : <h1 id="address-form-title">{mode === "add" ? "Tambah Alamat Baru" : "Edit Alamat"}</h1>}
              <p>Masukkan rincian lokasi penerima dengan lengkap untuk mempermudah kurir.</p>
            </div>

            <div className="address-default-switch-row">
              <div className="address-default-switch-label">
                <strong>Alamat Utama</strong>
                <small>{isDefault ? "Alamat default checkout" : "Jadikan default"}</small>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={isDefault}
                  disabled={busy}
                  onChange={e => setIsDefault(e.target.checked)}
                  aria-label="Atur sebagai alamat utama"
                />
                <span aria-hidden="true" />
              </label>
            </div>
          </div>

          {error && <div className="form-banner error" role="alert">{error}</div>}
          {success && <div className="form-banner success" role="status">{success}</div>}

          <form onSubmit={handleSubmit} className="address-form-grid">
            <div className="address-form-row">
              <div className="field">
                <label htmlFor="label">Label Alamat (misal: Rumah, Kantor)</label>
                <input
                  ref={firstFieldRef}
                  id="label"
                  type="text"
                  required
                  placeholder="Rumah"
                  maxLength={80}
                  autoComplete="off"
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
                  autoComplete="name"
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
                  type="tel"
                  required
                  pattern="[0-9+() -]{8,20}"
                  inputMode="tel"
                  autoComplete="tel"
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
                  autoComplete="email"
                  placeholder="budi@email.com"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="field full">
              <label htmlFor="area-search">Masukan Kode Pos Alamat</label>
              <div className="search-field">
                <input
                  id="area-search"
                  type="text"
                  role="combobox"
                  inputMode="search"
                  aria-required="true"
                  aria-expanded={areaResults.length > 0}
                  aria-controls="address-area-results"
                  aria-autocomplete="list"
                  placeholder="Cari kecamatan atau kode pos"
                  value={areaQuery}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (!searchingArea) void handleSearchArea();
                  }}
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
                <div id="address-area-results" className="area-results static address-area-results">
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
        </section>
      )}
    </div>
  );
}
