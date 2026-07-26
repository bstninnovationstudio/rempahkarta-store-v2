"use client";

import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

interface HolidayNoticeBannerProps {
  endAtWib?: string | null;
}

export function HolidayNoticeBanner({ endAtWib: propEndAtWib }: HolidayNoticeBannerProps) {
  const [endAtWib, setEndAtWib] = useState<string | null>(propEndAtWib || null);
  const [isHoliday, setIsHoliday] = useState<boolean>(Boolean(propEndAtWib));

  useEffect(() => {
    if (propEndAtWib !== undefined) return;
    async function checkStatus() {
      try {
        const res = await fetch("/api/store/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.isHoliday) {
            setIsHoliday(true);
            setEndAtWib(data.holidayEndAtWib);
          }
        }
      } catch {}
    }
    checkStatus();
  }, [propEndAtWib]);

  if (!isHoliday) return null;

  return (
    <div className="holiday-notice-banner" role="status">
      <div className="holiday-notice-icon">
        <Calendar size={18} aria-hidden="true" />
      </div>
      <div className="holiday-notice-text">
        <strong>Pengingat Masa Libur Toko</strong>
        <p>
          Pesanan Anda tetap dapat dipesan secara normal dan akan mulai diproses serta dikirimkan secara bertahap setelah masa libur berakhir{endAtWib ? ` pada ${endAtWib}` : ""}.
        </p>
      </div>
    </div>
  );
}
