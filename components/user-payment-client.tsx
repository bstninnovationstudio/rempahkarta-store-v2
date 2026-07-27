"use client";

import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, Save, Send, ShieldCheck, WalletCards } from "lucide-react";
import { errorMessage } from "@/lib/error-message";
import { useTurnstile } from "@/components/use-turnstile";
import { useRouter } from "next/navigation";
import { WhatsappOtpPanel } from "@/components/whatsapp-otp-panel";

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
  turnstileSiteKey: string;
  embedded?: boolean;
  isComplete?: boolean;
  contactComplete?: boolean;
  verifiedPhone?: string | null;
}

type OtpSession = {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
  resendCount: number;
};

function maskedAccountNumber(value: string | null | undefined) {
  if (!value) return "—";
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`;
}

export function UserPaymentClient({
  initialSetting,
  turnstileSiteKey,
  embedded = false,
  isComplete = false,
  contactComplete = true,
  verifiedPhone = null,
}: UserPaymentClientProps) {
  const router = useRouter();
  const [setting, setSetting] = useState<RefundSetting | null>(initialSetting);
  const [isEditing, setIsEditing] = useState(!initialSetting && contactComplete);
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
  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpPayloadKey, setOtpPayloadKey] = useState("");
  const { containerRef, token } = useTurnstile(turnstileSiteKey);

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
  const payloadKey = JSON.stringify(payload);
  const activeOtpSession = otpSession && otpPayloadKey === payloadKey ? otpSession : null;

  async function requestOtp(resend = false) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const turnstileToken = await token("user_otp_send");
      const response = await fetch("/api/user/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "REFUND_SETTING_VERIFICATION",
          ...(!resend ? { refundSetting: payload } : {}),
          ...(resend && activeOtpSession ? { challengeId: activeOtpSession.challengeId } : {}),
          turnstileToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengirim kode OTP");
      setOtpSession({
        challengeId: data.challengeId,
        expiresAt: data.expiresAt,
        resendAvailableAt: data.resendAvailableAt,
        resendCount: data.resendCount,
      });
      setOtpPayloadKey(payloadKey);
      setOtpCode("");
      setSuccess(data.message || "Kode OTP telah dikirim melalui WhatsApp.");
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Gagal mengirim kode OTP."));
    } finally {
      setBusy(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (!contactComplete || !verifiedPhone) {
        throw new Error("Lengkapi dan verifikasi kontak utama sebelum mengatur rekening refund.");
      }
      if (!activeOtpSession) {
        await requestOtp();
        return;
      }
      if (otpCode.length !== 6) {
        throw new Error("Masukkan 6 digit kode OTP yang dikirim melalui WhatsApp.");
      }
      const turnstileToken = await token("user_payment");
      const res = await fetch("/api/user/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          otpChallengeId: activeOtpSession.challengeId,
          otpCode,
          turnstileToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan refund");

      setSetting(data.setting);
      setSuccess("Pengaturan rekening refund berhasil disimpan.");
      setIsEditing(false);
      setOtpSession(null);
      setOtpCode("");
      setOtpPayloadKey("");
      router.refresh();
    } catch (e: unknown) {
      setError(errorMessage(e, "Gagal menyimpan data."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="payment" className={embedded ? "account-settings-section" : undefined} aria-labelledby="payment-settings-title">
      <div className={embedded ? "account-settings-section-head" : "user-content-header"}>
        {embedded && <span className="account-settings-icon"><WalletCards size={19} aria-hidden="true" /></span>}
        <div>
          <div className={embedded ? "account-settings-title-row" : undefined}>
            {embedded ? <h2 id="payment-settings-title">Rekening pengembalian dana</h2> : <h1 id="payment-settings-title">Pengaturan Refund</h1>}
            {embedded && (
              <span className={`completion-chip ${isComplete ? "complete" : "incomplete"}`}>
                {isComplete && <CheckCircle2 size={13} aria-hidden="true" />}
                {isComplete ? "Lengkap" : "Wajib diisi"}
              </span>
            )}
          </div>
          <p>Rekening ini akan digunakan untuk proses pengembalian dana. Mohon isi data dengan benar untuk menghindari kesalahan pengiriman dana.</p>
        </div>
      </div>

      {success && <div className="form-banner success" role="status">{success}</div>}
      {error && <div className="form-banner error" role="alert">{error}</div>}
      {!contactComplete ? (
        <div className="refund-contact-lock" role="status">
          <span><LockKeyhole size={18} aria-hidden="true" /></span>
          <div>
            <strong>Verifikasi kontak utama terlebih dahulu</strong>
            <p>Nama, email, dan nomor WhatsApp terverifikasi wajib lengkap sebelum rekening pengembalian dana dapat diatur.</p>
          </div>
        </div>
      ) : null}

      {setting && !isEditing ? (
        <div className="payment-info-box">
          <div className="payment-info-heading">
            <div>
              <span>Rekening aktif</span>
              <h3>Tujuan refund saat ini</h3>
            </div>
            <ShieldCheck size={18} aria-label="Data rekening tersimpan dengan aman" />
          </div>
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
                  <strong>{maskedAccountNumber(setting.bankNumber)}</strong>
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
                  <strong>{maskedAccountNumber(setting.ewalletNumber)}</strong>
                </div>
              </>
            )}
          </div>
          <div className="refund-edit-actions-row">
            <button
              type="button"
              className="button button-dark refund-edit-btn"
              onClick={() => setIsEditing(true)}
              disabled={!contactComplete}
            >
              Edit Rekening
            </button>
          </div>
        </div>
      ) : null}

      {contactComplete && (isEditing || !setting) && (
        <form onSubmit={handleSubmit} className="refund-setting-form">
          {setting && (
            <button
              type="button"
              className="address-form-head"
              onClick={() => {
                setType(setting.type);
                setBankName(setting.bankName || "");
                setBankOwnerName(setting.bankOwnerName || "");
                setBankNumber(setting.bankNumber || "");
                setEwalletName(setting.ewalletName || "");
                setEwalletOwnerName(setting.ewalletOwnerName || "");
                setEwalletNumber(setting.ewalletNumber || "");
                setOtpSession(null);
                setOtpCode("");
                setOtpPayloadKey("");
                setIsEditing(false);
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Kembali ke rekening aktif
            </button>
          )}

          <div className="account-settings-fields">
            <div className="field">
              <label htmlFor="refund-type">Jenis Rekening</label>
              <select
                id="refund-type"
                value={type}
                onChange={e => setType(e.target.value as "bank" | "ewallet")}
              >
                <option value="bank">Transfer Bank</option>
                <option value="ewallet">E-Wallet</option>
              </select>
            </div>

            {type === "bank" ? (
              <>
                <div className="field">
                  <label htmlFor="bankName">Nama Bank (misal: BCA, Mandiri, BNI)</label>
                  <input
                    id="bankName"
                    type="text"
                    required
                    placeholder="BCA"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    autoComplete="organization"
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
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="bankNumber">Nomor Rekening Bank</label>
                  <input
                    id="bankNumber"
                    type="text"
                    required
                    minLength={5}
                    maxLength={80}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="1234567890"
                    value={bankNumber}
                    onChange={e => setBankNumber(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="ewalletName">Nama E-Wallet (misal: GoPay, OVO, Dana)</label>
                  <input
                    id="ewalletName"
                    type="text"
                    required
                    placeholder="GoPay"
                    value={ewalletName}
                    onChange={e => setEwalletName(e.target.value)}
                    autoComplete="organization"
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
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="ewalletNumber">Nomor Telepon Terdaftar E-Wallet</label>
                  <input
                    id="ewalletNumber"
                    type="text"
                    required
                    minLength={5}
                    maxLength={80}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="081234567890"
                    value={ewalletNumber}
                    onChange={e => setEwalletNumber(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {activeOtpSession ? (
            <>
              <WhatsappOtpPanel
                idPrefix="refund"
                code={otpCode}
                onCodeChange={setOtpCode}
                expiresAt={activeOtpSession.expiresAt}
                resendAvailableAt={activeOtpSession.resendAvailableAt}
                resendCount={activeOtpSession.resendCount}
                busy={busy}
                onResend={() => requestOtp(true)}
                phoneLabel={verifiedPhone || "nomor terverifikasi"}
              />
              {activeOtpSession.resendCount >= 1 ? (
                <button
                  type="button"
                  className="otp-restart-button"
                  onClick={() => {
                    setOtpSession(null);
                    setOtpCode("");
                    setOtpPayloadKey("");
                    setSuccess("");
                  }}
                >
                  Mulai verifikasi baru
                </button>
              ) : null}
            </>
          ) : null}

          <div className="refund-setting-actions-row">
            <button type="submit" className="button button-dark refund-setting-submit" disabled={busy}>
              {activeOtpSession ? <Save size={15} /> : <Send size={15} />}
              {busy
                ? "Memproses…"
                : activeOtpSession
                  ? "Verifikasi & simpan rekening"
                  : "Kirim OTP untuk menyimpan"}
            </button>
          </div>
        </form>
      )}
      <div className="turnstile-hidden" ref={containerRef} />
    </section>
  );
}
