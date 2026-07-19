import { StoreHeader } from "@/components/store-header";
import { getCatalogProducts } from "@/lib/catalog";
import { CartPageClient } from "./cart-page-client";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const products = await getCatalogProducts();
  return (
    <>
      <StoreHeader />
      <CartPageClient allProducts={products} />
    </>
  );
}
