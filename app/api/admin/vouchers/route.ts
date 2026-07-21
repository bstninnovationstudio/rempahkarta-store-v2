import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasExactAppOrigin } from "@/lib/security";
import { readPagination, paginationMeta } from "@/lib/pagination";
import { serializeVoucher, voucherData, voucherInputSchema } from "@/lib/voucher-admin";

export async function GET(request: Request) {
  if (!await adminFromRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 20, maxPageSize: 100 });
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const status = url.searchParams.get("status");
  const where: Prisma.VoucherWhereInput = { ...(q ? { OR: [{ code: { contains: q } }, { name: { contains: q } }] } : {}), ...(status && ["ACTIVE", "PAUSE", "FINISH"].includes(status) ? { status: status as "ACTIVE" | "PAUSE" | "FINISH" } : {}) };
  const [total, rows] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: pageSize, include: { _count: { select: { usages: true } } } }),
  ]);
  return NextResponse.json({ data: rows.map(row => ({ ...serializeVoucher(row), usageCount: row._count.usages })), pagination: paginationMeta(total, page, pageSize) });
}

export async function POST(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  try {
    const parsed = voucherInputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data voucher tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const voucher = await prisma.$transaction(async tx => {
      const created = await tx.voucher.create({ data: voucherData(parsed.data) });
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "voucher.created", entityType: "voucher", entityId: created.id, after: { code: created.code, status: created.status } } });
      return created;
    });
    return NextResponse.json({ success: true, voucher: serializeVoucher(voucher) }, { status: 201 });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Voucher gagal dibuat" }, { status: 409 }); }
}
