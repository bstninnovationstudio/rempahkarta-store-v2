import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

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

    const newStatus = parsed.data.status;

    const updatedUser = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`User\` WHERE id = ${id} FOR UPDATE`);
      const existingUser = await tx.user.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existingUser) throw new Error("USER_NOT_FOUND");
      if (existingUser.status === newStatus) return { user: existingUser, changed: false };
      const user = await tx.user.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "BLOCK" ? { currentSessionId: null } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: typeof admin.email === "string" ? admin.email : String(admin.email),
          action: "user.update_status",
          entityType: "user",
          entityId: id,
          before: { status: existingUser.status },
          after: { status: newStatus, sessionRevoked: newStatus === "BLOCK" },
        },
      });

      return { user, changed: true };
    });

    return NextResponse.json({
      success: true,
      user: { id: updatedUser.user.id, status: updatedUser.user.status },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });
    }
    console.error("[Admin User Status Update Error]", error);
    return NextResponse.json({ error: "Gagal memperbarui status pelanggan" }, { status: 500 });
  }
}
