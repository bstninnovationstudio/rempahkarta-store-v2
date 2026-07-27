import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");
const PRIVATE_DIR = path.resolve(process.cwd(), "storage", "private");

export type MediaCategory = "products" | "returns" | "refunds" | "promotions" | "other";

export type MediaItem = {
  id: string; // safe relative path key
  relativePath: string; // e.g. "public/uploads/products/img.webp" or "storage/private/returns/ord1/img.webp"
  fileName: string;
  category: MediaCategory;
  categoryLabel: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  previewUrl: string;
  isUsed: boolean;
  usedBy: string[];
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function resolveSafeAbsolutePath(relativePath: string): string {
  const cleanRel = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const fullPath = path.resolve(process.cwd(), cleanRel);
  const isUploads = fullPath.startsWith(UPLOADS_DIR);
  const isPrivate = fullPath.startsWith(PRIVATE_DIR);
  if (!isUploads && !isPrivate) {
    throw new Error("Akses path media tidak valid atau di luar jangkauan izin");
  }
  return fullPath;
}

async function walkDir(dir: string): Promise<string[]> {
  let results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walkDir(fullPath);
        results = results.concat(sub);
      } else if (entry.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Dir may not exist
  }
  return results;
}

export async function scanAllMediaItems(): Promise<{
  items: MediaItem[];
  stats: {
    totalCount: number;
    totalSizeFormatted: string;
    unusedCount: number;
    unusedSizeFormatted: string;
  };
}> {
  const [uploadFiles, privateFiles] = await Promise.all([
    walkDir(UPLOADS_DIR),
    walkDir(PRIVATE_DIR),
  ]);

  const allFiles = [...uploadFiles, ...privateFiles];

  // Fetch DB references for usage check
  const [productImages, productVariants, returnRequests, refunds, promotions] = await Promise.all([
    prisma.productImage.findMany({
      select: { id: true, objectKey: true, product: { select: { name: true } } },
    }),
    prisma.productVariant.findMany({
      where: { imageKey: { not: null } },
      select: { id: true, name: true, imageKey: true, product: { select: { name: true } } },
    }),
    prisma.returnRequest.findMany({
      select: { id: true, publicNumber: true, evidence: true },
    }),
    prisma.refund.findMany({
      where: { proofObjectKey: { not: null } },
      select: { id: true, proofObjectKey: true, order: { select: { publicNumber: true } } },
    }),
    prisma.whatsappPromotionCampaign.findMany({
      where: { mediaFileName: { not: null } },
      select: { id: true, mediaFileName: true },
    }),
  ]);

  let totalSizeBytes = 0;
  let unusedSizeBytes = 0;
  let unusedCount = 0;

  const items: MediaItem[] = [];

  for (const fullPath of allFiles) {
    const relFromCwd = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
    const fileName = path.basename(fullPath);

    let stats: import("node:fs").Stats;
    try {
      stats = await fs.stat(fullPath);
    } catch {
      continue; // file disappeared
    }

    totalSizeBytes += stats.size;

    // Determine category & preview URL
    let category: MediaCategory = "other";
    let categoryLabel = "Lainnya";
    let previewUrl = "";

    if (relFromCwd.startsWith("public/uploads/products")) {
      category = "products";
      categoryLabel = "Produk";
      previewUrl = `/${relFromCwd.replace(/^public\//, "")}`;
    } else if (relFromCwd.startsWith("public/uploads/")) {
      category = "other";
      categoryLabel = "Upload Publik";
      previewUrl = `/${relFromCwd.replace(/^public\//, "")}`;
    } else if (relFromCwd.startsWith("storage/private/returns")) {
      category = "returns";
      categoryLabel = "Bukti Retur";
      previewUrl = `/api/admin/media/preview?path=${encodeURIComponent(relFromCwd)}`;
    } else if (relFromCwd.startsWith("storage/private/refunds")) {
      category = "refunds";
      categoryLabel = "Bukti Refund";
      previewUrl = `/api/admin/media/preview?path=${encodeURIComponent(relFromCwd)}`;
    } else if (relFromCwd.startsWith("storage/private/promotions")) {
      category = "promotions";
      categoryLabel = "Pesan Promosi";
      previewUrl = `/api/admin/media/preview?path=${encodeURIComponent(relFromCwd)}`;
    } else if (relFromCwd.startsWith("storage/private/")) {
      category = "other";
      categoryLabel = "Storage Privat";
      previewUrl = `/api/admin/media/preview?path=${encodeURIComponent(relFromCwd)}`;
    }

    // Check DB usages
    const usedBySet = new Set<string>();

    // 1. ProductImage
    for (const img of productImages) {
      if (img.objectKey && (img.objectKey === previewUrl || img.objectKey.endsWith(fileName))) {
        usedBySet.add(`Gambar Produk: ${img.product?.name || "Produk"}`);
      }
    }

    // 2. ProductVariant
    for (const varItem of productVariants) {
      if (varItem.imageKey && (varItem.imageKey === previewUrl || varItem.imageKey.endsWith(fileName))) {
        usedBySet.add(`Varian: ${varItem.name} (${varItem.product?.name || ""})`);
      }
    }

    // 3. ReturnRequest
    for (const ret of returnRequests) {
      if (Array.isArray(ret.evidence)) {
        const evList = ret.evidence as string[];
        if (evList.some(ev => typeof ev === "string" && (ev.endsWith(fileName) || ev === previewUrl))) {
          usedBySet.add(`Pengajuan Retur: ${ret.publicNumber}`);
        }
      }
    }

    // 4. Refund
    for (const ref of refunds) {
      if (ref.proofObjectKey && (ref.proofObjectKey === previewUrl || ref.proofObjectKey.endsWith(fileName))) {
        usedBySet.add(`Bukti Refund Pesanan: ${ref.order?.publicNumber || ref.id}`);
      }
    }
    for (const campaign of promotions) {
      if (campaign.mediaFileName === fileName) {
        usedBySet.add(`Pesan Promosi: ${campaign.id}`);
      }
    }

    const usedBy = Array.from(usedBySet);
    const isUsed = usedBy.length > 0;

    if (!isUsed) {
      unusedCount++;
      unusedSizeBytes += stats.size;
    }

    items.push({
      id: relFromCwd,
      relativePath: relFromCwd,
      fileName,
      category,
      categoryLabel,
      sizeBytes: stats.size,
      sizeFormatted: formatBytes(stats.size),
      createdAt: new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(stats.mtime),
      previewUrl,
      isUsed,
      usedBy,
    });
  }

  // Sort: Unused items first, then by createdAt desc
  items.sort((a, b) => {
    if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1;
    return b.fileName.localeCompare(a.fileName);
  });

  return {
    items,
    stats: {
      totalCount: items.length,
      totalSizeFormatted: formatBytes(totalSizeBytes),
      unusedCount,
      unusedSizeFormatted: formatBytes(unusedSizeBytes),
    },
  };
}

export async function deleteMediaItem(
  relativePath: string,
  force = false,
): Promise<{ success: boolean; isUsed: boolean; usedBy: string[] }> {
  const fullPath = resolveSafeAbsolutePath(relativePath);
  const fileName = path.basename(fullPath);

  // Check usage first
  const [productImages, productVariants, returnRequests, refunds, promotions] = await Promise.all([
    prisma.productImage.findMany({
      where: { objectKey: { contains: fileName } },
      select: { id: true, product: { select: { name: true } } },
    }),
    prisma.productVariant.findMany({
      where: { imageKey: { contains: fileName } },
      select: { id: true, name: true, product: { select: { name: true } } },
    }),
    prisma.returnRequest.findMany({
      select: { id: true, publicNumber: true, evidence: true },
    }),
    prisma.refund.findMany({
      where: { proofObjectKey: { contains: fileName } },
      select: { id: true, order: { select: { publicNumber: true } } },
    }),
    prisma.whatsappPromotionCampaign.findMany({
      where: { mediaFileName: { contains: fileName } },
      select: { id: true },
    }),
  ]);

  const usedBySet = new Set<string>();

  for (const img of productImages) {
    usedBySet.add(`Gambar Produk: ${img.product?.name || "Produk"}`);
  }
  for (const varItem of productVariants) {
    usedBySet.add(`Varian: ${varItem.name} (${varItem.product?.name || ""})`);
  }
  for (const ret of returnRequests) {
    if (Array.isArray(ret.evidence)) {
      const evList = ret.evidence as string[];
      if (evList.some(ev => typeof ev === "string" && ev.endsWith(fileName))) {
        usedBySet.add(`Pengajuan Retur: ${ret.publicNumber}`);
      }
    }
  }
  for (const ref of refunds) {
    usedBySet.add(`Bukti Refund Pesanan: ${ref.order?.publicNumber || ref.id}`);
  }
  for (const campaign of promotions) {
    usedBySet.add(`Pesan Promosi: ${campaign.id}`);
  }

  const usedBy = Array.from(usedBySet);
  const isUsed = usedBy.length > 0;

  if (isUsed && !force) {
    const error = Object.assign(new Error("File media sedang terpakai oleh data aktif"), {
      code: "REQUIRES_FORCE",
      usedBy,
    });
    throw error;
  }

  // If force delete is true, clean up database references cleanly
  if (isUsed && force) {
    await prisma.$transaction(async (tx) => {
      // 1. Delete ProductImage records
      await tx.productImage.deleteMany({
        where: { objectKey: { contains: fileName } },
      });
      // 2. Nullify ProductVariant.imageKey
      await tx.productVariant.updateMany({
        where: { imageKey: { contains: fileName } },
        data: { imageKey: null },
      });
      // 3. Nullify Refund.proofObjectKey
      await tx.refund.updateMany({
        where: { proofObjectKey: { contains: fileName } },
        data: { proofObjectKey: null },
      });
      await tx.whatsappPromotionCampaign.updateMany({
        where: { mediaFileName: { contains: fileName } },
        data: { mediaFileName: null, mediaContentType: null },
      });
      // 4. Update ReturnRequest evidence
      for (const ret of returnRequests) {
        if (Array.isArray(ret.evidence)) {
          const evList = ret.evidence as string[];
          if (evList.some(ev => typeof ev === "string" && ev.endsWith(fileName))) {
            const updatedEv = evList.filter(ev => typeof ev === "string" && !ev.endsWith(fileName));
            await tx.returnRequest.update({
              where: { id: ret.id },
              data: { evidence: updatedEv },
            });
          }
        }
      }
    });
  }

  // Delete file from disk
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") throw err;
  }

  return { success: true, isUsed, usedBy };
}

export async function clearAllUnusedMedia(): Promise<{ deletedCount: number }> {
  const { items } = await scanAllMediaItems();
  const unusedItems = items.filter(item => !item.isUsed);

  let deletedCount = 0;
  for (const item of unusedItems) {
    try {
      await deleteMediaItem(item.relativePath, false);
      deletedCount++;
    } catch {
      // ignore individual delete failure
    }
  }

  return { deletedCount };
}
