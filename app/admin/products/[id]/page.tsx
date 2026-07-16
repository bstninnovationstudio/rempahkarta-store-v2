import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { getCategoryOptions, getProductForEdit } from "@/lib/product-data";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductForEdit(id), getCategoryOptions()]);
  if (!product) notFound();
  return <ProductForm initial={product} categories={categories}/>;
}
