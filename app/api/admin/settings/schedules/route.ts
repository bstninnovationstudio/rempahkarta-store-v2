import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { assertNoScheduleOverlap, getStoreOperationalStatus } from "@/lib/store-schedule";

const scheduleSchema = z.object({
  type: z.enum(["HOLIDAY", "MAINTENANCE"]),
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(160, "Judul maksimal 160 karakter"),
  announcement: z.string().trim().min(5, "Pengumuman minimal 5 karakter").max(1000, "Pengumuman maksimal 1000 karakter"),
  startAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Waktu mulai tidak valid"),
  endAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Waktu berakhir tidak valid"),
});

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:schedules-list", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);

  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Sync current status first
    const currentOperationalStatus = await getStoreOperationalStatus();

    const schedules = await prisma.storeSchedule.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({
      success: true,
      currentOperationalStatus,
      schedules,
    });
  } catch (error) {
    console.error("[Admin Schedules GET Error]", error);
    return NextResponse.json({ error: "Gagal memuat jadwal operasional" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:schedules-create", limit: 15 });
  if (!rate.allowed) return rateLimitResponse(rate);

  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const json = await request.json();
    const parsed = scheduleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data jadwal operasional tidak valid. Mohon periksa kembali judul, pengumuman, dan rentang waktu yang dimasukkan.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const startAtDate = new Date(parsed.data.startAt);
    const endAtDate = new Date(parsed.data.endAt);
    const now = new Date();

    if (endAtDate <= now) {
      return NextResponse.json({ error: "Waktu berakhir jadwal operasional tidak boleh di masa lalu." }, { status: 400 });
    }

    const createdSchedule = await prisma.$transaction(async (tx) => {
      await assertNoScheduleOverlap(tx, startAtDate, endAtDate);

      const initialStatus = startAtDate <= now && endAtDate >= now ? "ACTIVE" : "SCHEDULED";

      const created = await tx.storeSchedule.create({
        data: {
          type: parsed.data.type,
          title: parsed.data.title,
          announcement: parsed.data.announcement,
          startAt: startAtDate,
          endAt: endAtDate,
          status: initialStatus,
          createdBy: typeof admin.email === "string" ? admin.email : String(admin.email),
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: typeof admin.email === "string" ? admin.email : String(admin.email),
          action: "store_schedule.create",
          entityType: "store_schedule",
          entityId: created.id,
          after: {
            type: created.type,
            title: created.title,
            startAt: created.startAt.toISOString(),
            endAt: created.endAt.toISOString(),
          },
        },
      });

      return created;
    });

    const currentOperationalStatus = await getStoreOperationalStatus();

    return NextResponse.json(
      {
        success: true,
        schedule: createdSchedule,
        currentOperationalStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Admin Schedule Create Error]", error);
    const message = error instanceof Error ? error.message : "Gagal menyimpan jadwal operasional";
    return NextResponse.json({ error: message }, { status: /bertabrakan|lebih baru/i.test(message) ? 409 : 500 });
  }
}
