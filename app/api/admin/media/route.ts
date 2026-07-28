import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { clearAllUnusedMedia, deleteMediaItem, scanAllMediaItems } from "@/lib/admin-media";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:media-list", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await scanAllMediaItems();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memindai media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const deleteSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete_single"),
    path: z.string().min(1),
    force: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal("clear_unused"),
  }),
]);

export async function DELETE(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:media-delete", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "clear_unused") {
      const result = await clearAllUnusedMedia();
      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "media.clear_unused",
          entityType: "media",
          entityId: "unused",
          after: { deletedCount: result.deletedCount },
        },
      });
      return NextResponse.json({ success: true, deletedCount: result.deletedCount });
    }

    const result = await deleteMediaItem(parsed.data.path, parsed.data.force);
    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        actorId: String(admin.email),
        action: parsed.data.force ? "media.force_deleted" : "media.deleted",
        entityType: "media",
        entityId: parsed.data.path.slice(0, 120),
        after: { force: parsed.data.force, wasUsed: result.isUsed },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error & { code?: string; usedBy?: string[] };
    if (err.code === "REQUIRES_FORCE") {
      return NextResponse.json(
        {
          error: "File media sedang terpakai oleh data aktif toko",
          requiresForce: true,
          usedBy: err.usedBy || [],
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: err.message || "Gagal menghapus file media" }, { status: 500 });
  }
}
