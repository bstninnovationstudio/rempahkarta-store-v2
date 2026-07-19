"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Contact, Save } from "lucide-react";
import { useState } from "react";
import { useTurnstile } from "@/components/use-turnstile";
import { errorMessage } from "@/lib/error-message";

interface UserContactSettingsClientProps {
  initialContact: {
    name: string;
    email: string;
    phone: string;
  };
  isComplete: boolean;
  turnstileSiteKey: string;
}

export function UserContactSettingsClient({
  initialContact,
  isComplete,
  turnstileSiteKey,
}: UserContactSettingsClientProps) {
  const router = useRouter();
  const [name, setName] = useState(initialContact.name);
  const [phone, setPhone] = useState(initialContact.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { containerRef, token } = useTurnstile(turnstileSiteKey);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const turnstileToken = await token("user_profile");
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          turnstileToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan data kontak");

      setSuccess("Data kontak berhasil disimpan.");
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
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0812 3456 7890"
            />
          </div>
          <div className="field full">
            <label htmlFor="settings-email">Alamat email</label>
            <input id="settings-email" type="email" value={initialContact.email} disabled />
            <small>Email mengikuti akun Google yang digunakan (tidak dapat di rubah).</small>
          </div>
        </div>
        <div className="account-settings-form-actions">
          <span>Pastikan nomor aktif dan dapat menerima pesan.</span>
          <button type="submit" className="button button-dark" disabled={busy}>
            <Save size={15} aria-hidden="true" />
            {busy ? "Menyimpan…" : "Simpan kontak"}
          </button>
        </div>
      </form>
      <div className="turnstile-hidden" ref={containerRef} />
    </section>
  );
}
