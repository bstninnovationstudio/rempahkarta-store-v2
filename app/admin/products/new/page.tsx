import { ProductForm } from "@/components/product-form";
import { emptyProduct, getCategoryOptions } from "@/lib/product-data";

export default async function NewProductPage() {
  return <ProductForm initial={emptyProduct} categories={await getCategoryOptions()}/>;
}
