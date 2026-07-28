"use client";

import Script from "next/script";
import { ImagePlus, LoaderCircle, Megaphone, Play, Send, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTurnstile } from "@/components/use-turnstile";
import { errorMessage } from "@/lib/error-message";

export type PromotionCampaignView = {
  id: string;
  message: string;
  hasMedia: boolean;
  status: "QUEUED" | "SENDING" | "COMPLETED";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  ambiguousCount: number;
  skippedCount: number;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
};

type AdminPromotionManagerProps = {
  initialCampaigns: PromotionCampaignView[];
  eligibleRecipientCount: number;
  turnstileSiteKey: string;
};

function statusLabel(status: PromotionCampaignView["status"]) {
  if (status === "COMPLETED") return "Selesai";
  if (status === "SENDING") return "Sedang dikirim";
  return "Menunggu pengiriman";
}

export function AdminPromotionManager({
  initialCampaigns,
  eligibleRecipientCount,
  turnstileSiteKey,
}: AdminPromotionManagerProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [busyCampaignId, setBusyCampaignId] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { containerRef, token } = useTurnstile(turnstileSiteKey);

  function mergeCampaign(
    update: Pick<PromotionCampaignView, "id" | "status" | "totalRecipients" | "sentCount" | "failedCount" | "ambiguousCount" | "skippedCount">,
  ) {
    setCampaigns(current => current.map(campaign => campaign.id === update.id
      ? { ...campaign, ...update }
      : campaign));
  }

  async function dispatchCampaign(campaignId: string) {
    setBusyCampaignId(campaignId);
    setError("");
    try {
      let hasPending = true;
      while (hasPending) {
        const response = await fetch(`/api/admin/promotions/${encodeURIComponent(campaignId)}/dispatch`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Pengiriman batch promosi gagal");
        mergeCampaign(data.campaign);
        hasPending = Boolean(data.hasPending);
      }
      setNotice("Pengiriman pesan promosi telah selesai diproses.");
      router.refresh();
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Pengiriman berhenti. Anda dapat melanjutkannya dari riwayat."));
    } finally {
      setBusyCampaignId("");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!window.confirm(
      `Kirim pesan ini kepada ${eligibleRecipientCount.toLocaleString("id-ID")} pengguna yang menyetujui notifikasi promosi?`,
    )) return;
    setCreating(true);
    try {
      const form = new FormData();
      form.set("message", message.trim());
      form.set("turnstileToken", await token("admin_promotion_send"));
      if (media) form.set("media", media);
      const response = await fetch("/api/admin/promotions", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat pesan promosi");

      const created: PromotionCampaignView = {
        id: data.campaign.id,
        message: message.trim(),
        hasMedia: Boolean(media),
        status: data.campaign.status,
        totalRecipients: data.campaign.totalRecipients,
        sentCount: 0,
        failedCount: 0,
        ambiguousCount: 0,
        skippedCount: 0,
        createdBy: "Admin saat ini",
        createdAt: new Date().toISOString(),
        completedAt: data.campaign.status === "COMPLETED" ? new Date().toISOString() : null,
      };
      setCampaigns(current => [created, ...current]);
      setMessage("");
      setMedia(null);
      if (fileRef.current) fileRef.current.value = "";
      if (created.status !== "COMPLETED") await dispatchCampaign(created.id);
      else setNotice("Tidak ada penerima yang memenuhi persetujuan promosi saat ini.");
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Gagal membuat pesan promosi."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      {notice ? <div className="form-banner success" role="status">{notice}</div> : null}
      {error ? <div className="form-banner error" role="alert">{error}</div> : null}

      <div className="promotion-layout">
        <section className="promotion-composer-card" aria-labelledby="promotion-composer-title">
          <div className="promotion-card-head">
            <span><Megaphone size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="promotion-composer-title">Buat pesan promosi</h2>
              <p>Pesan hanya dikirim kepada pengguna yang memberi persetujuan promosi WhatsApp.</p>
            </div>
          </div>
          <div className="promotion-audience">
            <Users size={17} aria-hidden="true" />
            <div>
              <strong>{eligibleRecipientCount.toLocaleString("id-ID")} penerima tersedia</strong>
              <span>Nomor aktif, terverifikasi, dan consent promosi menyala.</span>
            </div>
          </div>
          <form onSubmit={submit} className="promotion-form">
            <label className="field">
              <span>Isi pesan</span>
              <textarea
                required
                minLength={3}
                maxLength={3000}
                rows={9}
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Tulis informasi promo atau penawaran yang ingin dikirimkan…"
              />
              <small>{message.length}/3000 karakter. Footer pesan otomatis ditambahkan oleh sistem.</small>
            </label>
            <label className="promotion-media-picker">
              <ImagePlus size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>
                <strong>{media ? media.name : "Tambahkan gambar (opsional)"}</strong>
                <small>JPG atau PNG, maksimal 5 MB.</small>
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={event => setMedia(event.target.files?.[0] || null)}
              />
              {media ? (
                <button
                  type="button"
                  className="promotion-remove-media-icon"
                  aria-label="Hapus gambar"
                  title="Hapus gambar"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setMedia(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <button
              type="submit"
              className="button button-dark promotion-submit"
              disabled={creating || Boolean(busyCampaignId) || eligibleRecipientCount === 0}
            >
              {creating ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
              {creating ? "Menyiapkan pengiriman…" : "Kirim ke pengguna yang menyetujui"}
            </button>
          </form>
          <div ref={containerRef} className="turnstile-hidden" />
        </section>

        <section className="promotion-history-card" aria-labelledby="promotion-history-title">
          <div className="promotion-history-head">
            <div>
              <h2 id="promotion-history-title">Riwayat pesan</h2>
              <p>Log hasil pengiriman per kampanye WhatsApp.</p>
            </div>
            <span>{campaigns.length} terbaru</span>
          </div>
          <div className="promotion-history-list">
            {campaigns.map(campaign => {
              const processed = campaign.sentCount + campaign.failedCount + campaign.ambiguousCount + campaign.skippedCount;
              const progress = campaign.totalRecipients > 0
                ? Math.min(100, Math.round((processed / campaign.totalRecipients) * 100))
                : 100;
              const active = busyCampaignId === campaign.id;
              return (
                <article className="promotion-history-item" key={campaign.id}>
                  <div className="promotion-history-item-head">
                    <span className={`promotion-status ${campaign.status.toLowerCase()}`}>{statusLabel(campaign.status)}</span>
                    <time>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(campaign.createdAt))}</time>
                  </div>
                  <p>{campaign.message}</p>
                  {campaign.hasMedia ? (
                    <a href={`/api/admin/promotions/${encodeURIComponent(campaign.id)}/media`} target="_blank" rel="noreferrer">
                      Lihat media terlampir
                    </a>
                  ) : null}
                  <div className="promotion-progress" aria-label={`Progres ${progress}%`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="promotion-result-grid">
                    <span><strong>{campaign.totalRecipients}</strong> target</span>
                    <span className="success"><strong>{campaign.sentCount}</strong> terkirim</span>
                    <span className="danger"><strong>{campaign.failedCount}</strong> gagal</span>
                    <span><strong>{campaign.ambiguousCount}</strong> tidak pasti</span>
                    <span><strong>{campaign.skippedCount}</strong> dilewati</span>
                  </div>
                  {campaign.status !== "COMPLETED" ? (
                    <button
                      type="button"
                      className="button button-light"
                      disabled={Boolean(busyCampaignId)}
                      onClick={() => dispatchCampaign(campaign.id)}
                    >
                      {active ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />}
                      {active ? "Mengirim…" : "Lanjutkan pengiriman"}
                    </button>
                  ) : null}
                </article>
              );
            })}
            {campaigns.length === 0 ? (
              <div className="promotion-empty">
                <Megaphone size={24} aria-hidden="true" />
                <strong>Belum ada pesan promosi</strong>
                <p>Kampanye yang dikirim akan tercatat di sini.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
