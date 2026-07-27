"use client";

import React, { useEffect, useState } from "react";
import { Clock, Megaphone, Wrench } from "lucide-react";

interface StoreStatusResponse {
  isHoliday: boolean;
  isMaintenance: boolean;
  activeSchedule: {
    id: string;
    type: "HOLIDAY" | "MAINTENANCE";
    title: string;
    announcement: string;
    startAt: string;
    endAt: string;
  } | null;
  upcomingSchedule: {
    id: string;
    type: "HOLIDAY" | "MAINTENANCE";
    title: string;
    announcement: string;
    startAt: string;
    endAt: string;
    startsInMinutes: number;
  } | null;
  holidayEndAtWib: string | null;
  maintenanceEndAtWib: string | null;
  announcement: string | null;
}

export function StoreAnnouncementBar() {
  const [status, setStatus] = useState<StoreStatusResponse | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/store/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {}
    }
    fetchStatus();
  }, []);

  if (
    !status ||
    (!status.isHoliday &&
      !status.isMaintenance &&
      !status.upcomingSchedule &&
      !status.announcement)
  ) {
    return null;
  }

  const isUpcoming = !status.isHoliday && !status.isMaintenance && Boolean(status.upcomingSchedule);
  const isMaintenance = status.isMaintenance || status.upcomingSchedule?.type === "MAINTENANCE";
  const endWib = isMaintenance ? status.maintenanceEndAtWib : status.holidayEndAtWib;

  const defaultLabel = isUpcoming
    ? "INFORMASI OPERASIONAL"
    : isMaintenance
    ? "PEMELIHARAAN SISTEM"
    : "PENGUMUMAN OPERASIONAL";

  const defaultText = isMaintenance
    ? `Pemeliharaan Sistem: Toko kami sedang dalam peningkatan kualitas layanan${endWib ? ` hingga ${endWib}` : ""}. Fitur transaksi pengguna dijeda sementara.`
    : `Pengumuman Operasional: Toko sedang libur${endWib ? ` hingga ${endWib}` : ""}. Pesanan tetap dapat dibuat dan akan kami proses serta kirimkan secara bertahap setelah libur berakhir.`;

  const rawAnnouncementText = status.announcement || defaultText;

  // Extract label vs body text
  let labelText = defaultLabel;
  let bodyText = rawAnnouncementText;

  const match = rawAnnouncementText.match(/^(Informasi Operasional|Pengumuman Operasional|Pemeliharaan Sistem):\s*(.*)$/i);
  if (match) {
    labelText = match[1].toUpperCase();
    bodyText = match[2];
  }

  const barClass = isUpcoming ? "upcoming" : isMaintenance ? "maintenance" : "holiday";

  function renderIcon(ariaHidden = true) {
    if (isUpcoming) return <Clock size={13} className="shrink-0" aria-hidden={ariaHidden} />;
    if (isMaintenance) return <Wrench size={13} className="shrink-0" aria-hidden={ariaHidden} />;
    return <Megaphone size={13} className="shrink-0" aria-hidden={ariaHidden} />;
  }

  return (
    <div
      className={`store-announcement-bar ${barClass}`}
      role="region"
      aria-label="Pengumuman Operasional Toko"
    >
      <div className="announcement-marquee-wrap">
        <div className="announcement-marquee-content">
          <span className="announcement-item">
            <span className="announcement-label">
              {renderIcon(false)}
              <span>{labelText}</span>
            </span>
            <span className="announcement-body-text">{bodyText}</span>
          </span>
          <span className="announcement-item" aria-hidden="true">
            <span className="announcement-label">
              {renderIcon(true)}
              <span>{labelText}</span>
            </span>
            <span className="announcement-body-text">{bodyText}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
