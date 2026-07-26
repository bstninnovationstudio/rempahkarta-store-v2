import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSE", "BLOCK"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, { scope: "admin:user-status", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);

  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status user tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });
    }

    const newStatus = parsed.data.status;
    const oldStatus = existingUser.status;

    if (oldStatus === newStatus) {
      return NextResponse.json({ success: true, user: { id: existingUser.id, status: existingUser.status } });
    }

    const updatedUser = await prisma.$transaction(async tx => {
      const user = await tx.user.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: typeof admin.email === "string" ? admin.email : String(admin.email),
          action: "user.update_status",
          entityType: "user",
          entityId: id,
          before: { status: oldStatus },
          after: { status: newStatus },
        },
      });

      return user;
    });

    return NextResponse.json({
      success: true,
      user: { id: updatedUser.id, status: updatedUser.status },
    });
  } catch (error) {
    console.error("[Admin User Status Update Error]", error);
    return NextResponse.json({ error: "Gagal memperbarui status pelanggan" }, { status: 500 });
  }
}
