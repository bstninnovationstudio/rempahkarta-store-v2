import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function saveLocalImage(file: File, scope: "products" | "returns" | "refunds") {
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
  const root = path.join(process.cwd(), "public", "uploads");
  const directory = path.join(root, scope);
  await mkdir(directory, { recursive: true });
  const name = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await writeFile(path.join(directory, name), buffer, { flag: "wx", mode: 0o640 });
  return `/uploads/${scope}/${name}`;
}
