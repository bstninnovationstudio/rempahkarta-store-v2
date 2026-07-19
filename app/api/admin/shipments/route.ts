import { NextResponse } from "next/server";
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
  const status = url.searchParams.get("status")?.trim().slice(0, 50);
  const where: Prisma.ShipmentWhereInput = {
    ...(q ? { OR: [{ order: { publicNumber: { contains: q } } }, { trackingId: { contains: q } }, { waybillId: { contains: q } }] } : {}),
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        status: true,
        courierCompany: true,
        courierType: true,
        collectionMethod: true,
        trackingId: true,
        waybillId: true,
        updatedAt: true,
        order: { select: { publicNumber: true, fulfillmentState: true } },
      },
    }),
  ]);
  return NextResponse.json({
    data: rows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
    pagination: paginationMeta(total, page, pageSize),
  });
}

