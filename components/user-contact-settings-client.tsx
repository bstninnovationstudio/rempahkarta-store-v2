"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2, Contact, Save, Send } from "lucide-react";
import { useState } from "react";
import { useTurnstile } from "@/components/use-turnstile";
import { errorMessage } from "@/lib/error-message";
import { WhatsappOtpPanel } from "@/components/whatsapp-otp-panel";

interface UserContactSettingsClientProps {
  initialContact: {
    name: string;
    email: string;
    phone: string;
  };
  isComplete: boolean;
  phoneVerified: boolean;
  initialShipmentNotifications: boolean;
  initialPromotionNotifications: boolean;
  turnstileSiteKey: string;
}

type OtpSession = {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
  resendCount: number;
};

function comparablePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return digits;
}

export function UserContactSettingsClient({
  initialContact,
  isComplete,
  phoneVerified: initialPhoneVerified,
  initialShipmentNotifications,
  initialPromotionNotifications,
  turnstileSiteKey,
}: UserContactSettingsClientProps) {
  const router = useRouter();
  const [name, setName] = useState(initialContact.name);
  const [phone, setPhone] = useState(initialContact.phone);
  const [savedPhone, setSavedPhone] = useState(initialContact.phone);
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified);
  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [shipmentNotifications, setShipmentNotifications] = useState(initialShipmentNotifications);
  const [promotionNotifications, setPromotionNotifications] = useState(initialPromotionNotifications);
  const [preferenceBusy, setPreferenceBusy] = useState<"shipment" | "promotion" | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { containerRef, token } = useTurnstile(turnstileSiteKey);
  const needsPhoneVerification = !phoneVerified
    || comparablePhone(phone) !== comparablePhone(savedPhone);

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
          purpose: "PHONE_VERIFICATION",
          phone: phone.trim(),
          ...(resend && otpSession ? { challengeId: otpSession.challengeId } : {}),
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
      setOtpCode("");
      setSuccess(data.message || "Kode OTP telah dikirim melalui WhatsApp.");
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Gagal mengirim kode OTP."));
    } finally {
      setBusy(false);
    }
  }

  async function updatePreference(kind: "shipment" | "promotion", enabled: boolean) {
    setPreferenceBusy(kind);
    setError("");
    setSuccess("");
    try {
      const turnstileToken = await token("user_notifications");
      const response = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(kind === "shipment"
            ? { shipmentNotifications: enabled }
            : { promotionNotifications: enabled }),
          turnstileToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan preferensi notifikasi");
      setShipmentNotifications(Boolean(data.shipmentNotifications));
      setPromotionNotifications(Boolean(data.promotionNotifications));
      setSuccess("Preferensi notifikasi WhatsApp berhasil disimpan.");
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Gagal menyimpan preferensi notifikasi."));
    } finally {
      setPreferenceBusy("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (needsPhoneVerification && !otpSession) {
        await requestOtp();
        return;
      }
      if (needsPhoneVerification && otpCode.length !== 6) {
        throw new Error("Masukkan 6 digit kode OTP yang dikirim melalui WhatsApp.");
      }
      const turnstileToken = await token("user_profile");
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          ...(needsPhoneVerification && otpSession
            ? { otpChallengeId: otpSession.challengeId, otpCode }
            : {}),
          turnstileToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan data kontak");

      setSavedPhone(data.user.phone);
      setPhone(data.user.phone);
      setPhoneVerified(Boolean(data.user.phoneVerified));
      setOtpSession(null);
      setOtpCode("");
      setSuccess(needsPhoneVerification
        ? "Nomor WhatsApp berhasil diverifikasi dan data kontak disimpan."
        : "Data kontak berhasil disimpan.");
      router.refresh();
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Gagal menyimpan data kontak."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="contact" className="account-settings-section" aria-labelledby="contact-settings-title">
      <div className="account-settings-section-head">
        <span className="account-settings-icon"><Contact size={19} aria-hidden="true" /></span>
        <div>
          <div className="account-settings-title-row">
            <h2 id="contact-settings-title">Kontak utama</h2>
            <span className={`completion-chip ${isComplete ? "complete" : "incomplete"}`}>
              {isComplete && <CheckCircle2 size={13} aria-hidden="true" />}
              {isComplete ? "Lengkap" : "Wajib diisi"}
            </span>
          </div>
          <p>Informasi data diri terkait profil dan pengiriman.</p>
        </div>
      </div>

      {error && <div className="form-banner error" role="alert">{error}</div>}
      {success && <div className="form-banner success" role="status">{success}</div>}

      <form className="account-settings-form" onSubmit={handleSubmit}>
        <div className="account-settings-fields">
          <div className="field">
            <label htmlFor="settings-name">Nama lengkap</label>
            <input
              id="settings-name"
              type="text"
              required
              minLength={2}
              maxLength={160}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama sesuai identitas"
            />
          </div>
          <div className="field">
            <label htmlFor="settings-phone">Nomor WhatsApp / handphone</label>
            <div className="verified-input-wrap">
              <input
                id="settings-phone"
                type="tel"
                required
                inputMode="tel"
                minLength={8}
                maxLength={20}
                pattern="[0-9+() -]{8,20}"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setOtpSession(null);
                  setOtpCode("");
                }}
                placeholder="0812 3456 7890"
              />
              <span className={`phone-verification-badge ${needsPhoneVerification ? "unverified" : "verified"}`}>
                {needsPhoneVerification ? "Belum terverifikasi" : <><BadgeCheck size={13} /> Terverifikasi</>}
              </span>
            </div>
            <small>Kode keamanan akan dikirim ke nomor ini melalui WhatsApp.</small>
          </div>
          <div className="field full">
            <label htmlFor="settings-email">Alamat email</label>
            <input id="settings-email" type="email" value={initialContact.email} disabled />
            <small>Email mengikuti akun Google yang digunakan (tidak dapat di rubah).</small>
          </div>
        </div>
        {otpSession && needsPhoneVerification ? (
          <>
            <WhatsappOtpPanel
              idPrefix="contact"
              code={otpCode}
              onCodeChange={setOtpCode}
              expiresAt={otpSession.expiresAt}
              resendAvailableAt={otpSession.resendAvailableAt}
              resendCount={otpSession.resendCount}
              busy={busy}
              onResend={() => requestOtp(true)}
              phoneLabel={phone}
            />
            {otpSession.resendCount >= 1 ? (
              <button
                type="button"
                className="otp-restart-button"
                onClick={() => {
                  setOtpSession(null);
                  setOtpCode("");
                  setSuccess("");
                }}
              >
                Mulai verifikasi baru
              </button>
            ) : null}
          </>
        ) : null}
        <div className="account-settings-form-actions">
          <span>Pastikan nomor aktif dan dapat menerima pesan.</span>
          <button type="submit" className="button button-dark" disabled={busy}>
            {needsPhoneVerification && !otpSession
              ? <Send size={15} aria-hidden="true" />
              : <Save size={15} aria-hidden="true" />}
            {busy
              ? "Memproses…"
              : needsPhoneVerification && !otpSession
                ? "Kirim kode OTP"
                : needsPhoneVerification
                  ? "Verifikasi & simpan kontak"
                  : "Simpan kontak"}
          </button>
        </div>
      </form>
      <div className="whatsapp-consent-settings" aria-label="Persetujuan notifikasi WhatsApp">
        <div className="whatsapp-consent-row">
          <div>
            <strong>Aktifkan notifikasi perjalanan paket melalui WhatsApp</strong>
            <p>Anda akan menerima update pesanan secara detail melalui nomor WhatsApp yang telah didaftarkan.</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              role="switch"
              checked={shipmentNotifications}
              disabled={Boolean(preferenceBusy)}
              onChange={event => updatePreference("shipment", event.target.checked)}
              aria-label="Aktifkan notifikasi perjalanan paket melalui WhatsApp"
            />
            <span aria-hidden="true" />
          </label>
        </div>
        <div className="whatsapp-consent-row">
          <div>
            <strong>Aktifkan notifikasi promo, info, dan penawaran terbaik melalui WhatsApp</strong>
            <p>Anda akan menerima pesan promosi, info, dan penawaran terbaik melalui nomor WhatsApp yang telah didaftarkan.</p>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              role="switch"
              checked={promotionNotifications}
              disabled={Boolean(preferenceBusy)}
              onChange={event => updatePreference("promotion", event.target.checked)}
              aria-label="Aktifkan notifikasi promo dan penawaran melalui WhatsApp"
            />
            <span aria-hidden="true" />
          </label>
        </div>
        {!phoneVerified ? (
          <small>Persetujuan dapat disimpan sekarang, tetapi pesan baru dikirim setelah nomor WhatsApp terverifikasi.</small>
        ) : null}
      </div>
      <div className="turnstile-hidden" ref={containerRef} />
    </section>
  );
}
