import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { productInputSchema } from "@/lib/product-admin";
import { saveProduct } from "@/lib/product-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = productInputSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Data produk tidak valid", details: body.error.flatten() }, { status: 400 });
    const { id } = await params;
    const product = await saveProduct(body.data, String(admin.email), id);
    return NextResponse.json({ success: true, id: product.id, slug: product.slug });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Produk gagal diperbarui";
    const status = /tidak ditemukan/i.test(message) ? 404 : /sudah digunakan|tidak boleh|berubah/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
