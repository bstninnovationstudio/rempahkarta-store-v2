import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRevenueStats } from "@/lib/finance";
import { serializeBigInt } from "@/lib/serialize";

export async function GET(request: Request) {
  if (!await adminFromRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize")) || 20));
  const [stats, entries, total] = await Promise.all([
    getRevenueStats(),
    prisma.revenueLedger.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { order: { select: { publicNumber: true } } },
    }),
    prisma.revenueLedger.count(),
  ]);
  return NextResponse.json(serializeBigInt({ stats, entries, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } }));
}
