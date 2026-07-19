import { NextResponse } from "next/server";
import { getCatalogProducts } from "@/lib/catalog";
import { paginationMeta, readPagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, pageSize, skip } = readPagination(request.url, { defaultPageSize: 12, maxPageSize: 48 });
  const q = url.searchParams.get("q")?.trim().toLocaleLowerCase("id-ID") || "";
  const category = url.searchParams.get("category")?.trim().toLocaleLowerCase("id-ID") || "";
  const products = await getCatalogProducts();
  const filtered = products.filter(product => {
    const matchesQuery = !q || `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase("id-ID").includes(q);
    const matchesCategory = !category || product.category.toLocaleLowerCase("id-ID") === category;
    return matchesQuery && matchesCategory;
  });
  const response = NextResponse.json({
    data: filtered.slice(skip, skip + pageSize),
    pagination: paginationMeta(filtered.length, page, pageSize),
  });
  response.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=60");
  return response;
}

