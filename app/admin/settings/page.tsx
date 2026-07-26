import React from "react";
import { getStoreOperationalStatus } from "@/lib/store-schedule";
import { prisma } from "@/lib/db";
import { AdminSettingsSchedule } from "@/components/admin-settings-schedule";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const initialStatus = await getStoreOperationalStatus();

  const rawSchedules = await prisma.storeSchedule.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const initialSchedules = rawSchedules.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    announcement: item.announcement,
    startAt: item.startAt.toISOString(),
    endAt: item.endAt.toISOString(),
    status: item.status,
    createdBy: item.createdBy,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="admin-content admin-settings-page">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Manajemen Operasional Toko</p>
          <h1>Pengaturan Operasional Toko</h1>
          <p>
            Kelola jadwal mode libur toko, pemeliharaan sistem (*maintenance*), teks pengumuman berjalan (*running text*), dan riwayat jadwal operasional.
          </p>
        </div>
      </div>

      <AdminSettingsSchedule
        initialStatus={initialStatus}
        initialSchedules={initialSchedules}
      />
    </div>
  );
}
