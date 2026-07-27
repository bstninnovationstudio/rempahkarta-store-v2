import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type MediaScope = "products" | "returns" | "refunds" | "promotions";
type PrivateMediaScope = Exclude<MediaScope, "products">;

const safeSegment = /^[a-zA-Z0-9_-]{1,180}$/;
const safeFileName = /^[0-9]+-[a-f0-9-]{36}\.(jpg|png|webp)$/;

export async function saveLocalImage(
  file: File,
  scope: MediaScope,
  ownerId?: string,
  maxFiles = 10,
) {
  const extension = allowedTypes.get(file.type);
  if (!extension) throw new Error("Format gambar harus JPG, PNG, atau WebP");
  if (file.size < 12) throw new Error("File gambar tidak valid");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 5 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  const validSignature = extension === "jpg"
    ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : extension === "png"
      ? buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
      : buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!validSignature) throw new Error("Isi file tidak sesuai dengan format gambar");
  if (scope !== "products" && (!ownerId || !safeSegment.test(ownerId))) {
    throw new Error("Pemilik media privat tidak valid");
  }
  const directory = scope === "products"
    ? path.join(process.cwd(), "public", "uploads", scope)
    : privateDirectory(scope, ownerId!);
  await mkdir(directory, { recursive: true });
  if (scope !== "products") {
    const existing = await readdir(directory);
    if (existing.length >= maxFiles) throw new Error("Batas lampiran untuk data ini sudah tercapai");
  }
  const name = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await writeFile(path.join(directory, name), buffer, { flag: "wx", mode: 0o640 });
  return scope === "products" ? `/uploads/${scope}/${name}` : name;
}

function privateDirectory(scope: PrivateMediaScope, ownerId: string) {
  if (!safeSegment.test(ownerId)) throw new Error("Pemilik media privat tidak valid");
  return path.join(process.cwd(), "storage", "private", scope, ownerId);
}

export async function readPrivateImage(scope: PrivateMediaScope, ownerId: string, fileName: string) {
  if (!safeFileName.test(fileName)) return null;
  try {
    const data = await readFile(path.join(privateDirectory(scope, ownerId), fileName));
    const extension = path.extname(fileName).slice(1);
    const contentType = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    return { data, contentType };
  } catch {
    return null;
  }
}

export async function privateImageExists(scope: PrivateMediaScope, ownerId: string, fileName: string) {
  if (!safeFileName.test(fileName)) return false;
  try {
    return (await stat(path.join(privateDirectory(scope, ownerId), fileName))).isFile();
  } catch {
    return false;
  }
}
