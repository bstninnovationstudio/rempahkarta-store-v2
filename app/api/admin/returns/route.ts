import { NextResponse } from "next/server";
import { ReturnState } from "@prisma/client";
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
  const state = url.searchParams.get("state") as ReturnState | null;
  const validStates = new Set(Object.values(ReturnState));
  const where: Prisma.ReturnRequestWhereInput = {
    ...(q ? { OR: [{ publicNumber: { contains: q } }, { order: { publicNumber: { contains: q } } }] } : {}),
    ...(state && validStates.has(state) ? { state } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        publicNumber: true,
        reason: true,
        cause: true,
        state: true,
        source: true,
        refundAmount: true,
        createdAt: true,
        order: { select: { publicNumber: true } },
        refunds: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, amount: true } },
      },
    }),
  ]);
  return NextResponse.json({
    data: rows.map(row => ({
      ...row,
      refundAmount: Number(row.refundAmount || 0),
      refunds: row.refunds.map(refund => ({ ...refund, amount: Number(refund.amount) })),
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: paginationMeta(total, page, pageSize),
  });
}
