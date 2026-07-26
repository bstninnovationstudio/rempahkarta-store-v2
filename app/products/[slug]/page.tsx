import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductDetailView } from "@/components/product-detail-view";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { getCatalogProducts } from "@/lib/catalog";

import { HolidayNoticeBanner } from "@/components/holiday-notice-banner";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await getCatalogProducts();
  const product = products.find(item => item.slug === slug);
  if (!product) notFound();
  return (
    <>
      <StoreHeader />
      <HolidayNoticeBanner />
      <div className="breadcrumbs">

        <Link href="/">Home</Link>
        <ChevronRight size={12} />
        <Link href="/">{product.category}</Link>
        <ChevronRight size={12} />
        <span>{product.name}</span>
      </div>
      
      <ProductDetailView product={product} />

      <section className="recommended">
        <div className="section-head">
          <div>
            <p className="eyebrow">Pilihan untuk Anda</p>
            <h2>Lengkapi koleksi</h2>
          </div>
        </div>
        <div className="product-grid">
          {products
            .filter(item => item.id !== product.id)
            .slice(0, 4)
            .map(item => (
              <ProductCard key={item.id} product={item} />
            ))}
        </div>
      </section>
      <StoreFooter />
    </>
  );
}
