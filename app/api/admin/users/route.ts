import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paginationMeta, readPagination } from "@/lib/pagination";

function maskEmail(value: string) {
  const [local, domain = ""] = value.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
}
function maskPhone(value: string | null) {
  if (!value) return null;
  return value.length > 7 ? `${value.slice(0, 4)}••••${value.slice(-3)}` : "••••";
}

export async function GET(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 20, maxPageSize: 100 });
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
    : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true, addresses: true } },
        refundSetting: { select: { id: true } },
      },
    }),
  ]);
  return NextResponse.json({
    data: users.map(user => ({
      id: user.id,
      name: user.name,
      email: maskEmail(user.email),
      phone: maskPhone(user.phone),
      createdAt: user.createdAt.toISOString(),
      orderCount: user._count.orders,
      profileComplete: Boolean(user.phone && user._count.addresses > 0 && user.refundSetting),
    })),
    pagination: paginationMeta(total, page, pageSize),
  });
}

