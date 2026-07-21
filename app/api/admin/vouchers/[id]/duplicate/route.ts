import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasExactAppOrigin } from "@/lib/security";

const schema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,50}$/) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Kode promo baru tidak valid" }, { status: 400 });
  try {
    const { id } = await params;
    const created = await prisma.$transaction(async tx => {
      const source = await tx.voucher.findUnique({ where: { id } });
      if (!source) throw new Error("Voucher tidak ditemukan");
      const voucher = await tx.voucher.create({ data: { name: `${source.name} (salinan)`, description: source.description, code: parsed.data.code, status: "PAUSE", available: source.available, mode: source.mode, discountValue: source.discountValue, minPurchase: source.minPurchase, maxDiscount: source.maxDiscount, dailyLimit: source.dailyLimit, totalLimit: source.totalLimit, userLimit: source.userLimit, startAt: source.startAt, endAt: source.endAt, target: source.target } });
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "voucher.duplicated", entityType: "voucher", entityId: voucher.id, after: { sourceId: id, code: voucher.code } } });
      return voucher;
    });
    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Voucher gagal diduplikasi" }, { status: 409 }); }
}
