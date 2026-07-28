import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { resolveSafeMediaPath } from "@/lib/media-path";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:media-preview", limit: 120 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const relPath = searchParams.get("path");
  if (!relPath) return NextResponse.json({ error: "Param path wajib diisi" }, { status: 400 });

  let fullPath: string;
  try {
    fullPath = resolveSafeMediaPath(relPath);
  } catch {
    return NextResponse.json({ error: "Akses path tidak valid" }, { status: 403 });
  }

  try {
    const stats = await fs.lstat(fullPath);
    if (!stats.isFile() || stats.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File media tidak valid" }, { status: 400 });
    }
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase().slice(1);
    const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${path.basename(fullPath)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File media tidak ditemukan" }, { status: 404 });
  }
}
