import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getStoreOperationalStatus } from "@/lib/store-schedule";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, { scope: "admin:schedule-cancel", limit: 15 });
  if (!rate.allowed) return rateLimitResponse(rate);

  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const schedule = await prisma.storeSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Jadwal operasional tidak ditemukan" }, { status: 404 });
    }

    if (schedule.status === "COMPLETED" || schedule.status === "CANCELLED") {
      return NextResponse.json({ error: "Jadwal operasional sudah selesai atau dibatalkan sebelumnya." }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.storeSchedule.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: typeof admin.email === "string" ? admin.email : String(admin.email),
          action: "store_schedule.cancel",
          entityType: "store_schedule",
          entityId: id,
          before: { status: schedule.status },
          after: { status: "CANCELLED" },
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
    console.error("[Admin Schedule Cancel Error]", error);
    return NextResponse.json({ error: "Gagal membatalkan jadwal operasional" }, { status: 500 });
  }
}
