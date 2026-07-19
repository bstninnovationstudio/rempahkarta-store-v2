import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const root = process.cwd();
const validFileName = /^[0-9]+-[a-f0-9-]{36}\.(jpg|png|webp)$/;

async function exists(filePath) {
  try { await access(filePath, constants.R_OK); return true; }
  catch { return false; }
}

async function digest(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function copyVerified(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "EEXIST" || await digest(source) !== await digest(destination)) throw error;
  }
}

function legacyFile(value, scope) {
  const prefix = `/uploads/${scope}/`;
  if (typeof value !== "string" || !value.startsWith(prefix)) return null;
  const fileName = value.slice(prefix.length);
  return validFileName.test(fileName) ? fileName : null;
}

async function main() {
  const [returnRows, refundRows] = await Promise.all([
    prisma.returnRequest.findMany({
      select: { id: true, orderId: true, evidence: true, order: { select: { publicNumber: true } } },
    }),
    prisma.refund.findMany({
      where: { proofObjectKey: { not: null } },
      select: { id: true, returnRequestId: true, proofObjectKey: true },
    }),
  ]);

  const filePlans = [];
  const returnUpdates = [];
  const refundUpdates = [];
  const warnings = [];

  for (const row of returnRows) {
    if (!Array.isArray(row.evidence)) continue;
    let changed = false;
    const nextEvidence = [];
    for (const value of row.evidence) {
      const fileName = legacyFile(value, "returns");
      if (!fileName) { nextEvidence.push(value); continue; }
      const source = path.join(root, "public", "uploads", "returns", fileName);
      if (!await exists(source)) {
        warnings.push(`Bukti retur tidak ditemukan untuk record ${row.id}: ${fileName}`);
        nextEvidence.push(value);
        continue;
      }
      const destination = path.join(root, "storage", "private", "returns", row.orderId, fileName);
      const nextPath = `/api/orders/${encodeURIComponent(row.order.publicNumber)}/media/${encodeURIComponent(fileName)}`;
      filePlans.push({ scope: "returns", source, destination, fileName });
      nextEvidence.push(nextPath);
      changed = true;
    }
    if (changed) returnUpdates.push({ id: row.id, evidence: nextEvidence });
  }

  for (const row of refundRows) {
    const fileName = legacyFile(row.proofObjectKey, "refunds");
    if (!fileName) continue;
    if (!row.returnRequestId) {
      warnings.push(`Refund ${row.id} tidak memiliki returnRequestId; bukti dilewati agar relasi tidak ditebak.`);
      continue;
    }
    const source = path.join(root, "public", "uploads", "refunds", fileName);
    if (!await exists(source)) {
      warnings.push(`Bukti refund tidak ditemukan untuk record ${row.id}: ${fileName}`);
      continue;
    }
    const destination = path.join(root, "storage", "private", "refunds", row.returnRequestId, fileName);
    const nextPath = `/api/returns/${encodeURIComponent(row.returnRequestId)}/media/${encodeURIComponent(fileName)}`;
    filePlans.push({ scope: "refunds", source, destination, fileName });
    refundUpdates.push({ id: row.id, proofObjectKey: nextPath });
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    files: filePlans.length,
    returnRecords: returnUpdates.length,
    refundRecords: refundUpdates.length,
    warnings,
  }, null, 2));
  if (!apply || filePlans.length === 0) return;

  for (const plan of filePlans) await copyVerified(plan.source, plan.destination);

  const operations = [
    ...returnUpdates.map(item => prisma.returnRequest.update({ where: { id: item.id }, data: { evidence: item.evidence } })),
    ...refundUpdates.map(item => prisma.refund.update({ where: { id: item.id }, data: { proofObjectKey: item.proofObjectKey } })),
  ];
  for (let index = 0; index < operations.length; index += 100) {
    await prisma.$transaction(operations.slice(index, index + 100));
  }

  const uniqueSources = new Map(filePlans.map(plan => [plan.source, plan]));
  for (const plan of uniqueSources.values()) {
    const backup = path.join(root, "storage", "private-migration-backup", plan.scope, plan.fileName);
    await mkdir(path.dirname(backup), { recursive: true });
    if (await exists(backup)) {
      console.warn(`Backup sudah ada; file publik belum dipindah: ${plan.source}`);
      continue;
    }
    await rename(plan.source, backup);
  }
  console.log("Migrasi media privat selesai. File publik lama dipindah ke storage/private-migration-backup.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
