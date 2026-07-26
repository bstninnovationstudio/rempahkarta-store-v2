import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");
const PRIVATE_DIR = path.resolve(process.cwd(), "storage", "private");

export async function GET(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const relPath = searchParams.get("path");
  if (!relPath) return NextResponse.json({ error: "Param path wajib diisi" }, { status: 400 });

  const cleanRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const fullPath = path.resolve(process.cwd(), cleanRel);

  const isUploads = fullPath.startsWith(UPLOADS_DIR);
  const isPrivate = fullPath.startsWith(PRIVATE_DIR);
  if (!isUploads && !isPrivate) {
    return NextResponse.json({ error: "Akses path tidak valid" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase().slice(1);
    const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File media tidak ditemukan" }, { status: 404 });
  }
}
