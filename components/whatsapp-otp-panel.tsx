"use client";

import { Clock, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type WhatsappOtpPanelProps = {
  code: string;
  onCodeChange: (value: string) => void;
  expiresAt: string;
  resendAvailableAt: string;
  resendCount: number;
  busy: boolean;
  onResend: (isExpired?: boolean) => void;
  phoneLabel: string;
  idPrefix: string;
};

function remainingSeconds(target: string) {
  return Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000));
}

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function WhatsappOtpPanel({
  code,
  onCodeChange,
  expiresAt,
  resendAvailableAt,
  resendCount,
  busy,
  onResend,
  phoneLabel,
  idPrefix,
}: WhatsappOtpPanelProps) {
  const [expiresIn, setExpiresIn] = useState(() => remainingSeconds(expiresAt));
  const [resendIn, setResendIn] = useState(() => remainingSeconds(resendAvailableAt));

  useEffect(() => {
    const update = () => {
      setExpiresIn(remainingSeconds(expiresAt));
      setResendIn(remainingSeconds(resendAvailableAt));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, resendAvailableAt]);

  const isExpired = expiresIn === 0;
  const canResend = isExpired || (resendCount < 1 && resendIn === 0);

  return (
    <div className="whatsapp-otp-panel">
      <div className="whatsapp-otp-heading">
        <div className="whatsapp-otp-icon-wrap">
          <ShieldCheck size={20} aria-hidden="true" />
        </div>
        <div>
          <strong className="whatsapp-otp-title">Masukkan kode OTP WhatsApp</strong>
          <p>Kode 6 digit telah dikirim ke <strong className="whatsapp-otp-phone">{phoneLabel}</strong>. Jangan berikan kode kepada siapa pun.</p>
        </div>
      </div>
      <div className="whatsapp-otp-controls">
        <label htmlFor={`${idPrefix}-otp-code`}>
          <KeyRound size={15} aria-hidden="true" />
          Kode OTP
        </label>
        <div className="whatsapp-otp-input-row">
          <input
            id={`${idPrefix}-otp-code`}
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={event => onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            aria-describedby={`${idPrefix}-otp-timer`}
          />
          <div
            id={`${idPrefix}-otp-timer`}
            className={`whatsapp-otp-timer-badge ${isExpired ? "expired" : ""}`}
          >
            <Clock size={13} aria-hidden="true" />
            <span>{expiresIn > 0 ? `Berlaku ${clock(expiresIn)}` : "Kode kedaluwarsa"}</span>
          </div>
          {resendCount < 1 || isExpired ? (
            <button
              type="button"
              className="button button-soft whatsapp-otp-resend-btn"
              onClick={() => onResend(isExpired)}
              disabled={!canResend || busy}
            >
              <RefreshCw size={14} className={busy ? "spin" : undefined} aria-hidden="true" />
              {isExpired ? "Kirim OTP baru" : "Kirim ulang OTP"}
            </button>
          ) : null}
        </div>
        {isExpired ? (
          <span className="whatsapp-otp-resend-info">
            Kode telah kedaluwarsa. Klik &quot;Kirim OTP baru&quot; untuk mengulang pengiriman.
          </span>
        ) : resendCount >= 1 ? (
          <span className="whatsapp-otp-resend-info">
            Kirim ulang sudah digunakan. Jika kode tetap tidak diterima, tunggu kode kedaluwarsa atau mulai verifikasi baru.
          </span>
        ) : resendIn > 0 ? (
          <span className="whatsapp-otp-resend-info">
            Kirim ulang tersedia dalam {resendIn} detik.
          </span>
        ) : null}
      </div>
    </div>
  );
}
