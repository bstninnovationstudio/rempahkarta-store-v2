import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { CategoryEditor } from "@/components/category-editor";
import { prisma } from "@/lib/db";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [category, products] = await Promise.all([
    prisma.productCategory.findUnique({ where: { id } }),
    prisma.product.findMany({ select: { id: true, name: true, status: true, categoryId: true }, orderBy: { name: "asc" } }),
  ]);
  if (!category) notFound();
  return <div className="admin-content admin-category-detail-page"><div className="admin-page-head"><div><Link href="/admin/categories" className="eyebrow admin-back"><ChevronLeft size={13} aria-hidden="true" /> Kembali ke kategori</Link><h1>{category.name}</h1><p>Edit informasi kategori dan atur produk yang termasuk di dalamnya.</p></div></div><CategoryEditor category={{ id: category.id, name: category.name, description: category.description }} products={products.map(item => ({ id: item.id, name: item.name, status: item.status, selected: item.categoryId === id }))}/></div>;
}
