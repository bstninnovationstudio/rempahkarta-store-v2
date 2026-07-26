import { CategoryManager } from "@/components/category-manager";
import { prisma } from "@/lib/db";

export default async function CategoriesPage() {
  const categories = await prisma.productCategory.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  return <div className="admin-content admin-categories-page"><CategoryManager categories={categories.map(item => ({ id: item.id, name: item.name, description: item.description, productCount: item._count.products }))}/></div>;
}
