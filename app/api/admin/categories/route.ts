import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/product-admin";

const schema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(255).optional() });

export async function POST(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data kategori tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const base = slugify(parsed.data.name);
    const exists = await prisma.productCategory.findFirst({ where: { OR: [{ name: parsed.data.name }, { slug: base }] } });
    if (exists) return NextResponse.json({ error: "Nama kategori sudah digunakan" }, { status: 409 });
    const category = await prisma.$transaction(async tx => {
      const created = await tx.productCategory.create({ data: { name: parsed.data.name, slug: base, description: parsed.data.description || null } });
      await tx.auditLog.create({ data: { actorType: "admin", actorId: String(admin.email), action: "category.created", entityType: "category", entityId: created.id, after: { name: created.name } } });
      return created;
    });
    return NextResponse.json({ success: true, id: category.id }, { status: 201 });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Kategori gagal disimpan" }, { status: 500 }); }
}
