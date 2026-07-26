"use client";

import React from "react";
import Image from "next/image";
import { Wrench, ShieldCheck, Clock } from "lucide-react";

interface StoreMaintenanceScreenProps {
  endAtWib?: string | null;
  announcement?: string | null;
}

export function StoreMaintenanceScreen({ endAtWib, announcement }: StoreMaintenanceScreenProps) {
  return (
    <div className="maintenance-screen-page">
      <div className="maintenance-screen-card">
        <div className="maintenance-logo-circle">
          <Image src="/main-logo.webp" alt="REMPAHKARTA Logo" width={56} height={56} className="maintenance-logo-img" unoptimized />
        </div>
        <div className="maintenance-header-badge">
          <Wrench size={16} aria-hidden="true" />
          <span>Pemeliharaan Sistem</span>
        </div>

        <h1 className="maintenance-title">Peningkatan Kualitas Layanan</h1>

        <p className="maintenance-description">
          {announcement || "Kami sedang melakukan pemeliharaan rutin untuk meningkatkan kenyamanan dan keamanan transaksi Anda."}
        </p>

        {endAtWib && (
          <div className="maintenance-time-box">
            <Clock size={16} aria-hidden="true" />
            <span>Estimasi Selesai: <strong>{endAtWib}</strong></span>
          </div>
        )}

        <div className="maintenance-note-footer">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>Data dan transaksi tersimpan secara aman. Silakan kembali setelah pemeliharaan selesai.</span>
        </div>
      </div>
    </div>
  );
}
