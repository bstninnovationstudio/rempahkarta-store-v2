"use client";

import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type WhatsappOtpPanelProps = {
  code: string;
  onCodeChange: (value: string) => void;
  expiresAt: string;
  resendAvailableAt: string;
  resendCount: number;
  busy: boolean;
  onResend: () => void;
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

  const canResend = resendCount < 1 && resendIn === 0 && expiresIn > 0;

  return (
    <div className="whatsapp-otp-panel">
      <div className="whatsapp-otp-heading">
        <span><ShieldCheck size={17} aria-hidden="true" /></span>
        <div>
          <strong>Masukkan kode OTP WhatsApp</strong>
          <p>Kode 6 digit telah dikirim ke {phoneLabel}. Jangan berikan kode kepada siapa pun.</p>
        </div>
      </div>
      <div className="whatsapp-otp-controls">
        <label htmlFor={`${idPrefix}-otp-code`}>
          <KeyRound size={15} aria-hidden="true" />
          Kode OTP
        </label>
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
        <span id={`${idPrefix}-otp-timer`} className={expiresIn === 0 ? "expired" : undefined}>
          {expiresIn > 0 ? `Berlaku ${clock(expiresIn)}` : "Kode kedaluwarsa"}
        </span>
      </div>
      <div className="whatsapp-otp-resend">
        {resendCount >= 1 ? (
          <span>Kirim ulang sudah digunakan. Jika kode tetap tidak diterima, mulai verifikasi baru.</span>
        ) : (
          <>
            <span>{resendIn > 0 ? `Kirim ulang tersedia dalam ${resendIn} detik.` : "Belum menerima kode?"}</span>
            <button type="button" className="button button-soft" onClick={onResend} disabled={!canResend || busy}>
              <RefreshCw size={14} aria-hidden="true" />
              Kirim ulang OTP
            </button>
          </>
        )}
      </div>
    </div>
  );
}
