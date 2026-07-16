"use client";

import React, { useState } from "react";
import { Settings, X, Save } from "lucide-react";
import { errorMessage } from "@/lib/error-message";

interface Customer {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
}

interface CustomerProfileSectionProps {
  customer: Customer;
}

export function CustomerProfileSection({ customer }: CustomerProfileSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [avatarFailed, setAvatarFailed] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    if (!name.trim() || !phone.trim()) {
      setError("Nama lengkap dan nomor handphone wajib diisi.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan profil");

      setSuccess("Profil berhasil diperbarui!");
      setTimeout(() => {
        setModalOpen(false);
        window.location.reload(); // Refresh to update all server-rendered info
      }, 1000);
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal memperbarui profil."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="profile-section-wrapper">
        <div className="profile-section-left">
          {customer.avatarUrl && !avatarFailed ? (
            <img
              src={customer.avatarUrl}
              alt=""
              className="profile-section-avatar"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="profile-section-initials">
              {customer.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="profile-section-center">
          <h3>{customer.name}</h3>
          <p>{customer.email}</p>
        </div>
        <div className="profile-section-right">
          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setModalOpen(true);
            }}
            className="profile-edit-btn"
            title="Edit Profil"
            aria-label="Edit Profil"
            type="button"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="profile-modal-overlay">
          <form className="profile-modal-card" onSubmit={handleSave}>
            <div className="profile-modal-head">
              <h2>Edit Profil Anda</h2>
              <button
                type="button"
                className="profile-edit-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="profile-modal-body">
              {error && <div className="form-banner error">{error}</div>}
              {success && (
                <div className="form-banner success">
                  {success}
                </div>
              )}

              <div className="field">
                <label htmlFor="modal-email">Alamat Email (Tidak dapat diubah)</label>
                <input
                  id="modal-email"
                  type="email"
                  disabled
                  value={customer.email}
                />
              </div>

              <div className="field">
                <label htmlFor="modal-name">Nama Lengkap</label>
                <input
                  id="modal-name"
                  type="text"
                  required
                  maxLength={160}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Budi Santoso"
                />
              </div>

              <div className="field">
                <label htmlFor="modal-phone">Nomor WhatsApp / Handphone</label>
                <input
                  id="modal-phone"
                  type="text"
                  required
                  pattern="[0-9+() -]{8,20}"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="081234567890"
                />
                <small>Wajib dilengkapi untuk koordinasi pengiriman pesanan.</small>
              </div>
            </div>

            <div className="profile-modal-foot">
              <button
                type="button"
                className="button button-light"
                onClick={() => setModalOpen(false)}
                disabled={busy}
              >
                Batal
              </button>
              <button
                type="submit"
                className="button button-dark"
                disabled={busy}
              >
                <Save size={14} /> Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
