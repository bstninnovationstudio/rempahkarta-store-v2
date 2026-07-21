import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPagination, paginationMeta } from "@/lib/pagination";
import { hasExactAppOrigin } from "@/lib/security";
import { serializeVoucher, voucherData, voucherInputSchema } from "@/lib/voucher-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminFromRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 10, maxPageSize: 50 });
    const voucher = await prisma.voucher.findUnique({ where: { id } });
    if (!voucher) return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });
    const [total, usages] = await Promise.all([
      prisma.voucherUsage.count({ where: { voucherId: id } }),
      prisma.voucherUsage.findMany({
        where: { voucherId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          discountAmount: true,
          createdAt: true,
          order: { select: { publicNumber: true, guestName: true } },
          user: { select: { name: true, email: true } },
        },
      }),
    ]);
    return NextResponse.json({
      voucher: serializeVoucher(voucher),
      usages: usages.map(usage => ({
        ...usage,
        discountAmount: Number(usage.discountAmount),
      })),
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Gagal mengambil data voucher" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  try {
    const parsed = voucherInputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data voucher tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const { id } = await params;
    const voucher = await prisma.$transaction(async tx => {
      const before = await tx.voucher.findUnique({ where: { id } });
      if (!before) throw new Error("Voucher tidak ditemukan");
      const updated = await tx.voucher.update({ where: { id }, data: voucherData(parsed.data) });
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "voucher.updated", entityType: "voucher", entityId: id, before: { code: before.code, status: before.status }, after: { code: updated.code, status: updated.status } } });
      return updated;
    });
    return NextResponse.json({ success: true, voucher: serializeVoucher(voucher) });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Voucher gagal diperbarui" }, { status: 409 }); }
}
