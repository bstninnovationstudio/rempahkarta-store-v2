import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { clearAllUnusedMedia, deleteMediaItem, scanAllMediaItems } from "@/lib/admin-media";

export async function GET() {
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
      return NextResponse.json({ success: true, deletedCount: result.deletedCount });
    }

    const result = await deleteMediaItem(parsed.data.path, parsed.data.force);
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
