"use client";

import React, { useState } from "react";
import { CreditCard, Award, Save } from "lucide-react";
import { errorMessage } from "@/lib/error-message";

interface RefundSetting {
  id?: string;
  type: "bank" | "ewallet";
  bankName?: string | null;
  bankOwnerName?: string | null;
  bankNumber?: string | null;
  ewalletName?: string | null;
  ewalletOwnerName?: string | null;
  ewalletNumber?: string | null;
}

interface UserPaymentClientProps {
  initialSetting: RefundSetting | null;
}

export function UserPaymentClient({ initialSetting }: UserPaymentClientProps) {
  const [setting, setSetting] = useState<RefundSetting | null>(initialSetting);
  const [type, setType] = useState<"bank" | "ewallet">(initialSetting?.type || "bank");

  // Form states
  const [bankName, setBankName] = useState(initialSetting?.bankName || "");
  const [bankOwnerName, setBankOwnerName] = useState(initialSetting?.bankOwnerName || "");
  const [bankNumber, setBankNumber] = useState(initialSetting?.bankNumber || "");

  const [ewalletName, setEwalletName] = useState(initialSetting?.ewalletName || "");
  const [ewalletOwnerName, setEwalletOwnerName] = useState(initialSetting?.ewalletOwnerName || "");
  const [ewalletNumber, setEwalletNumber] = useState(initialSetting?.ewalletNumber || "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    const payload = type === "bank"
      ? {
          type,
          bankName: bankName.trim(),
          bankOwnerName: bankOwnerName.trim(),
          bankNumber: bankNumber.trim(),
        }
      : {
          type,
          ewalletName: ewalletName.trim(),
          ewalletOwnerName: ewalletOwnerName.trim(),
          ewalletNumber: ewalletNumber.trim(),
        };

    try {
      const res = await fetch("/api/user/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan refund");

      setSetting(data.setting);
      setSuccess("Pengaturan rekening refund berhasil disimpan.");
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal menyimpan data."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="user-content-header">
        <h1>Pengaturan Refund</h1>
        <p>Atur rekening bank atau e-wallet Anda untuk menerima pengembalian dana jika terjadi pembatalan/retur pesanan.</p>
      </div>

      {success && <div className="form-banner success">{success}</div>}
      {error && <div className="login-error">{error}</div>}

      {setting && (
        <div className="payment-info-box">
          <h3>Rekening Refund Saat Ini</h3>
          <div className="payment-info-grid">
            {setting.type === "bank" ? (
              <>
                <div className="payment-info-row">
                  <span>Jenis</span>
                  <strong>Transfer Bank</strong>
                </div>
                <div className="payment-info-row">
                  <span>Nama Bank</span>
                  <strong>{setting.bankName}</strong>
                </div>
                <div className="payment-info-row">
                  <span>Atas Nama</span>
                  <strong>{setting.bankOwnerName}</strong>
                </div>
                <div className="payment-info-row">
                  <span>Nomor Rekening</span>
                  <strong>{setting.bankNumber}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="payment-info-row">
                  <span>Jenis</span>
                  <strong>E-Wallet</strong>
                </div>
                <div className="payment-info-row">
                  <span>Layanan</span>
                  <strong>{setting.ewalletName}</strong>
                </div>
                <div className="payment-info-row">
                  <span>Atas Nama</span>
                  <strong>{setting.ewalletOwnerName}</strong>
                </div>
                <div className="payment-info-row">
                  <span>Nomor Handphone</span>
                  <strong>{setting.ewalletNumber}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="refund-setting-form">
        <h3>{setting ? "Ubah pengaturan rekening" : "Atur rekening baru"}</h3>
        
        <div className="type-selector">
          <button
            type="button"
            className={`type-btn ${type === "bank" ? "active" : ""}`}
            onClick={() => setType("bank")}
          >
            <CreditCard size={16} /> Transfer Bank
          </button>
          <button
            type="button"
            className={`type-btn ${type === "ewallet" ? "active" : ""}`}
            onClick={() => setType("ewallet")}
          >
            <Award size={16} /> E-Wallet
          </button>
        </div>

        {type === "bank" ? (
          <div className="refund-field-group">
            <div className="field">
              <label htmlFor="bankName">Nama Bank (misal: BCA, Mandiri, BNI)</label>
              <input
                id="bankName"
                type="text"
                required
                placeholder="BCA"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bankOwnerName">Nama Pemilik Rekening</label>
              <input
                id="bankOwnerName"
                type="text"
                required
                placeholder="Budi Santoso"
                value={bankOwnerName}
                onChange={e => setBankOwnerName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bankNumber">Nomor Rekening Bank</label>
              <input
                id="bankNumber"
                type="text"
                required
                placeholder="1234567890"
                value={bankNumber}
                onChange={e => setBankNumber(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="refund-field-group">
            <div className="field">
              <label htmlFor="ewalletName">Nama E-Wallet (misal: GoPay, OVO, Dana)</label>
              <input
                id="ewalletName"
                type="text"
                required
                placeholder="GoPay"
                value={ewalletName}
                onChange={e => setEwalletName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ewalletOwnerName">Nama Pemilik Akun E-Wallet</label>
              <input
                id="ewalletOwnerName"
                type="text"
                required
                placeholder="Budi Santoso"
                value={ewalletOwnerName}
                onChange={e => setEwalletOwnerName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ewalletNumber">Nomor Telepon Terdaftar E-Wallet</label>
              <input
                id="ewalletNumber"
                type="text"
                required
                placeholder="081234567890"
                value={ewalletNumber}
                onChange={e => setEwalletNumber(e.target.value)}
              />
            </div>
          </div>
        )}

        <button type="submit" className="button button-dark refund-setting-submit" disabled={busy}>
          <Save size={15} /> {busy ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
    </div>
  );
}
