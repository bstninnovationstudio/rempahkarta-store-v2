"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Wrench } from "lucide-react";

interface StoreStatusResponse {
  isHoliday: boolean;
  isMaintenance: boolean;
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

  if (!status || (!status.isHoliday && !status.isMaintenance)) {
    return null;
  }

  const isMaintenance = status.isMaintenance;
  const endWib = isMaintenance ? status.maintenanceEndAtWib : status.holidayEndAtWib;
  const defaultText = isMaintenance
    ? `🛠️ Pemeliharaan Sistem: Toko kami sedang dalam peningkatan kualitas layanan${endWib ? ` hingga ${endWib}` : ""}. Fitur transaksi pengguna dijeda sementara.`
    : `📢 Pengumuman Operasional: Toko sedang libur${endWib ? ` hingga ${endWib}` : ""}. Pesanan tetap dapat dibuat dan akan kami proses serta kirimkan secara bertahap setelah libur berakhir.`;

  const announcementText = status.announcement || defaultText;

  return (
    <div className={`store-announcement-bar ${isMaintenance ? "maintenance" : "holiday"}`} role="region" aria-label="Pengumuman Operasional Toko">
      <div className="announcement-marquee-wrap">
        <div className="announcement-marquee-content">
          <span className="announcement-item">
            {isMaintenance ? <Wrench size={14} className="shrink-0" aria-hidden="true" /> : <Megaphone size={14} className="shrink-0" aria-hidden="true" />}
            <span>{announcementText}</span>
          </span>
          <span className="announcement-item" aria-hidden="true">
            {isMaintenance ? <Wrench size={14} className="shrink-0" /> : <Megaphone size={14} className="shrink-0" />}
            <span>{announcementText}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
