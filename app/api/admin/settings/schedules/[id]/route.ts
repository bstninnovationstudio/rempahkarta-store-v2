import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDevToolsEnabled } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { assertNoScheduleOverlap, getStoreOperationalStatus } from "@/lib/store-schedule";

const editScheduleSchema = z.object({
  type: z.enum(["HOLIDAY", "MAINTENANCE"]).optional(),
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(160, "Judul maksimal 160 karakter").optional(),
  announcement: z.string().trim().min(5, "Pengumuman minimal 5 karakter").max(1000, "Pengumuman maksimal 1000 karakter").optional(),
  startAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Waktu mulai tidak valid").optional(),
  endAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Waktu berakhir tidak valid").optional(),
  status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, { scope: "admin:schedule-edit", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);

  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDevToolsEnabled()) {
    return NextResponse.json(
      { error: "Fitur edit log operasional hanya tersedia pada mode development (APP_MODE=development)." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.storeSchedule.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Jadwal operasional tidak ditemukan" }, { status: 404 });
    }

    const json = await request.json();
    const parsed = editScheduleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data perubahan tidak valid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const newStartAt = parsed.data.startAt ? new Date(parsed.data.startAt) : existing.startAt;
    const newEndAt = parsed.data.endAt ? new Date(parsed.data.endAt) : existing.endAt;

    if (newEndAt <= newStartAt) {
      return NextResponse.json(
        { error: "Waktu berakhir jadwal operasional harus lebih baru daripada waktu mulai." },
        { status: 400 }
      );
    }

    const targetStatus = parsed.data.status || existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      if (targetStatus === "SCHEDULED" || targetStatus === "ACTIVE") {
        await assertNoScheduleOverlap(tx, newStartAt, newEndAt, id);
      }

      const result = await tx.storeSchedule.update({
        where: { id },
        data: {
          ...(parsed.data.type ? { type: parsed.data.type } : {}),
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          ...(parsed.data.announcement ? { announcement: parsed.data.announcement } : {}),
          startAt: newStartAt,
          endAt: newEndAt,
          status: targetStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: typeof admin.email === "string" ? admin.email : String(admin.email),
          action: "store_schedule.edit_dev",
          entityType: "store_schedule",
          entityId: id,
          before: {
            type: existing.type,
            title: existing.title,
            startAt: existing.startAt.toISOString(),
            endAt: existing.endAt.toISOString(),
            status: existing.status,
          },
          after: {
            type: result.type,
            title: result.title,
            startAt: result.startAt.toISOString(),
            endAt: result.endAt.toISOString(),
            status: result.status,
          },
        },
      });

      return result;
    });

    const currentOperationalStatus = await getStoreOperationalStatus();

    return NextResponse.json({
      success: true,
      schedule: updated,
      currentOperationalStatus,
    });
  } catch (error) {
    console.error("[Admin Schedule Dev Edit Error]", error);
    const message = error instanceof Error ? error.message : "Gagal mengedit jadwal operasional";
    return NextResponse.json({ error: message }, { status: /bertabrakan|lebih baru/i.test(message) ? 409 : 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, { scope: "admin:schedule-delete", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);

  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDevToolsEnabled()) {
    return NextResponse.json(
      { error: "Fitur hapus log operasional hanya tersedia pada mode development (APP_MODE=development)." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.storeSchedule.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Jadwal operasional tidak ditemukan" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.storeSchedule.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: typeof admin.email === "string" ? admin.email : String(admin.email),
          action: "store_schedule.delete_dev",
          entityType: "store_schedule",
          entityId: id,
          before: {
            type: existing.type,
            title: existing.title,
            startAt: existing.startAt.toISOString(),
            endAt: existing.endAt.toISOString(),
            status: existing.status,
          },
        },
      });
    });

    const currentOperationalStatus = await getStoreOperationalStatus();

    return NextResponse.json({
      success: true,
      deletedId: id,
      currentOperationalStatus,
    });
  } catch (error) {
    console.error("[Admin Schedule Dev Delete Error]", error);
    return NextResponse.json({ error: "Gagal menghapus log jadwal operasional" }, { status: 500 });
  }
}
