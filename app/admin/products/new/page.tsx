import { ProductForm } from "@/components/product-form";
import { emptyProduct, getCategoryOptions, getProductForDuplicate } from "@/lib/product-data";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ duplicate?: string }> }) {
  const { duplicate } = await searchParams;
  const [categories, duplicateProduct] = await Promise.all([
    getCategoryOptions(),
    duplicate ? getProductForDuplicate(duplicate) : Promise.resolve(null),
  ]);
  return <ProductForm initial={duplicateProduct || emptyProduct} categories={categories}/>;
}
