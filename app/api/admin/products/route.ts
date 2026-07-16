import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { isDemo } from "@/lib/env";
import { productInputSchema } from "@/lib/product-admin";
import { saveProduct } from "@/lib/product-service";

export async function POST(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = productInputSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Data produk tidak valid", details: body.error.flatten() }, { status: 400 });
    if (isDemo()) return NextResponse.json({ success: true, id: "demo-product" }, { status: 201 });
    const product = await saveProduct(body.data, String(admin.email));
    return NextResponse.json({ success: true, id: product.id, slug: product.slug }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Produk gagal disimpan";
    const status = /tidak ditemukan|sudah digunakan|tidak boleh|berubah/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
