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

  // Find candidate schedules that are either currently active or scheduled
  const candidates = await prisma.storeSchedule.findMany({
    where: {
      status: { in: ["SCHEDULED", "ACTIVE"] },
    },
    orderBy: { startAt: "asc" },
  });

  let activeSchedule: StoreSchedule | null = null;
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
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates).catch((err) => {
      console.error("[StoreSchedule Sync Error]", err);
    });
  }

  const isHoliday = activeSchedule?.type === "HOLIDAY";
  const isMaintenance = activeSchedule?.type === "MAINTENANCE";

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
    holidayEndAtWib: isHoliday && activeSchedule ? formatWibDateTime(activeSchedule.endAt) : null,
    maintenanceEndAtWib: isMaintenance && activeSchedule ? formatWibDateTime(activeSchedule.endAt) : null,
    announcement: activeSchedule ? activeSchedule.announcement : null,
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
