import { NextResponse } from "next/server";
import { RefundState } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paginationMeta, readPagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 20, maxPageSize: 100 });
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const state = url.searchParams.get("status") as RefundState | null;
  const validStates = new Set(Object.values(RefundState));
  const where: Prisma.RefundWhereInput = {
    ...(q ? { OR: [{ order: { publicNumber: { contains: q } } }, { returnRequest: { publicNumber: { contains: q } } }, { reference: { contains: q } }] } : {}),
    ...(state && validStates.has(state) ? { status: state } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.refund.count({ where }),
    prisma.refund.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        reference: true,
        processedAt: true,
        createdAt: true,
        order: { select: { publicNumber: true } },
        returnRequest: { select: { publicNumber: true } },
      },
    }),
  ]);
  return NextResponse.json({
    data: rows.map(row => ({
      ...row,
      amount: Number(row.amount),
      createdAt: row.createdAt.toISOString(),
      processedAt: row.processedAt?.toISOString() || null,
    })),
    pagination: paginationMeta(total, page, pageSize),
  });
}
