import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CategoryManager } from "@/components/category-manager";
import { prisma } from "@/lib/db";
import { isDemo } from "@/lib/env";

export default async function CategoriesPage() {
  const categories = isDemo() ? [] : await prisma.productCategory.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } });
  return <div className="admin-content admin-categories-page"><div className="admin-page-head"><div><Link href="/admin/products" className="eyebrow admin-back"><ChevronLeft size={13} aria-hidden="true" /> Kembali ke produk</Link><h1>Kategori</h1><p>Tambah, edit, hapus, dan atur keanggotaan produk pada setiap kategori.</p></div></div><CategoryManager categories={categories.map(item => ({ id: item.id, name: item.name, description: item.description, productCount: item._count.products }))}/></div>;
}
