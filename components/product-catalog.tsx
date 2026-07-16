"use client";

import { useState } from "react";
import { ProductCard } from "./product-card";
import type { Product } from "@/lib/types";

interface ProductCatalogProps {
  products: Product[];
}

export function ProductCatalog({ products }: ProductCatalogProps) {
  // Extract unique categories from actual products, fallback to "Tanpa kategori" if null
  const categories = ["Semua", ...Array.from(new Set(products.map(p => p.category || "Tanpa kategori").filter(Boolean)))];

  const [activeCategory, setActiveCategory] = useState("Semua");

  const filteredProducts = activeCategory === "Semua"
    ? products
    : products.filter(p => (p.category || "Tanpa kategori") === activeCategory);

  return (
    <>
      <div className="filter-row" aria-label="Kategori produk">
        {categories.map(category => (
          <button
            key={category}
            type="button"
            className={`filter-chip ${activeCategory === category ? "active" : ""}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="product-grid">
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
