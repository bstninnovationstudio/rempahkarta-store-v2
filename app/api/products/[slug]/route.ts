import { NextResponse } from "next/server";
import { getCatalogProducts } from "@/lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = (await getCatalogProducts()).find(candidate => candidate.slug === slug);
  if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  const response = NextResponse.json({ data: product });
  response.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=60");
  return response;
}

