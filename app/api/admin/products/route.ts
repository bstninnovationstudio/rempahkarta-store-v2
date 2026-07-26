import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";

import { productInputSchema } from "@/lib/product-admin";
import { saveProduct } from "@/lib/product-service";
import type { Prisma, ProductStatus } from "@prisma/client";
import { ProductStatus as ProductStatusValues } from "@prisma/client";
import { prisma } from "@/lib/db";
import { paginationMeta, readPagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 20, maxPageSize: 100 });
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const status = url.searchParams.get("status") as ProductStatus | null;
  const categoryId = url.searchParams.get("categoryId")?.trim();
  const validStatuses = new Set(Object.values(ProductStatusValues));
  const where: Prisma.ProductWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { variants: { some: { sku: { contains: q } } } }] } : {}),
    ...(status && validStatuses.has(status) ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ position: "asc" }, { id: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { objectKey: true } },
        variants: {
          where: { active: true },
          select: {
            sku: true,
            price: true,
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
      },
    }),
  ]);
  return NextResponse.json({
    data: rows.map(row => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
      variants: row.variants.map(variant => ({
        sku: variant.sku,
        price: Number(variant.price),
        available: variant.inventory.reduce((sum, level) => sum + Math.max(0, level.onHand - level.reserved), 0),
      })),
    })),
    pagination: paginationMeta(total, page, pageSize),
  });
}

export async function POST(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = productInputSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Data produk tidak valid", details: body.error.flatten() }, { status: 400 });

    const product = await saveProduct(body.data, String(admin.email));
    return NextResponse.json({ success: true, id: product.id, slug: product.slug }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Produk gagal disimpan";
    const status = /tidak ditemukan|sudah digunakan|tidak boleh|berubah/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
