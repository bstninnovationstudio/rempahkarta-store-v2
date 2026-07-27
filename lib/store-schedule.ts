import { prisma } from "./db";
import type { Prisma, StoreSchedule, ScheduleType } from "@prisma/client";

export interface OperationalStatusResult {
  isHoliday: boolean;
  isMaintenance: boolean;
  activeSchedule: {
    id: string;
    type: ScheduleType;
    title: string;
    announcement: string;
    startAt: string;
    endAt: string;
  } | null;
  upcomingSchedule: {
    id: string;
    type: ScheduleType;
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

export function formatWibDateTime(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const formatted = new Intl.DateTimeFormat("id-ID", options).format(date);
  return `${formatted.replace(/\./g, ":")} WIB`;
}

export async function getStoreOperationalStatus(): Promise<OperationalStatusResult> {
  const now = new Date();
  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  // Find candidate schedules that are either currently active or scheduled
  const candidates = await prisma.storeSchedule.findMany({
    where: {
      status: { in: ["SCHEDULED", "ACTIVE"] },
    },
    orderBy: { startAt: "asc" },
  });

  let activeSchedule: StoreSchedule | null = null;
  let upcomingSchedule: StoreSchedule | null = null;
  const updates: Promise<unknown>[] = [];

  for (const schedule of candidates) {
    if (schedule.endAt < now) {
      if (schedule.status !== "COMPLETED") {
        updates.push(
          prisma.storeSchedule.update({
            where: { id: schedule.id },
            data: { status: "COMPLETED" },
          })
        );
      }
    } else if (schedule.startAt <= now && schedule.endAt >= now) {
      if (schedule.status !== "ACTIVE") {
        updates.push(
          prisma.storeSchedule.update({
            where: { id: schedule.id },
            data: { status: "ACTIVE" },
          })
        );
      }
      if (!activeSchedule) {
        activeSchedule = { ...schedule, status: "ACTIVE" };
      }
    } else if (schedule.startAt > now && schedule.startAt <= thirtyMinutesFromNow) {
      if (!upcomingSchedule) {
        upcomingSchedule = schedule;
      }
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates).catch((err) => {
      console.error("[StoreSchedule Sync Error]", err);
    });
  }

  const isHoliday = activeSchedule?.type === "HOLIDAY";
  const isMaintenance = activeSchedule?.type === "MAINTENANCE";

  let announcementText: string | null = null;

  if (activeSchedule) {
    announcementText = activeSchedule.announcement;
  } else if (upcomingSchedule) {
    const diffMs = upcomingSchedule.startAt.getTime() - now.getTime();
    const minutes = Math.max(1, Math.ceil(diffMs / 60000));
    const startWib = formatWibDateTime(upcomingSchedule.startAt);
    const modeLabel = upcomingSchedule.type === "MAINTENANCE" ? "Pemeliharaan sistem" : "Masa libur toko";
    announcementText = `Informasi Operasional: ${modeLabel} ("${upcomingSchedule.title}") akan dimulai pada ${startWib} (dalam ${minutes} menit). ${upcomingSchedule.announcement}`;

  }

  const upcomingInMinutes = upcomingSchedule
    ? Math.max(1, Math.ceil((upcomingSchedule.startAt.getTime() - now.getTime()) / 60000))
    : 0;

  return {
    isHoliday,
    isMaintenance,
    activeSchedule: activeSchedule
      ? {
          id: activeSchedule.id,
          type: activeSchedule.type,
          title: activeSchedule.title,
          announcement: activeSchedule.announcement,
          startAt: activeSchedule.startAt.toISOString(),
          endAt: activeSchedule.endAt.toISOString(),
        }
      : null,
    upcomingSchedule: upcomingSchedule
      ? {
          id: upcomingSchedule.id,
          type: upcomingSchedule.type,
          title: upcomingSchedule.title,
          announcement: upcomingSchedule.announcement,
          startAt: upcomingSchedule.startAt.toISOString(),
          endAt: upcomingSchedule.endAt.toISOString(),
          startsInMinutes: upcomingInMinutes,
        }
      : null,
    holidayEndAtWib: isHoliday && activeSchedule ? formatWibDateTime(activeSchedule.endAt) : null,
    maintenanceEndAtWib: isMaintenance && activeSchedule ? formatWibDateTime(activeSchedule.endAt) : null,
    announcement: announcementText,
  };
}

export async function assertNoScheduleOverlap(
  tx: Prisma.TransactionClient | typeof prisma,
  startAt: Date,
  endAt: Date,
  excludeId?: string
): Promise<void> {
  if (startAt >= endAt) {
    throw new Error("Waktu berakhir jadwal operasional harus lebih baru daripada waktu mulai.");
  }

  const overlapping = await tx.storeSchedule.findFirst({
    where: {
      status: { in: ["SCHEDULED", "ACTIVE"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { startAt: { lt: endAt } },
        { endAt: { gt: startAt } },
      ],
    },
  });

  if (overlapping) {
    const overlappingType = overlapping.type === "HOLIDAY" ? "Libur" : "Maintenance";
    throw new Error(
      `Jadwal operasional tidak dapat disimpan karena rentang waktu bertabrakan dengan jadwal ${overlappingType} ("${overlapping.title}") yang sudah terdaftar.`
    );
  }
}
