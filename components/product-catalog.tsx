"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductCard } from "./product-card";
import type { Product } from "@/lib/types";

interface ProductCatalogProps {
  products: Product[];
  categoryNames?: string[];
  autoFocusSearch?: boolean;
}

export function ProductCatalog({ products, categoryNames = [], autoFocusSearch = false }: ProductCatalogProps) {
  const productCategories = new Set(products.map(product => product.category || "Tanpa kategori"));
  const orderedCategories = categoryNames.filter(category => productCategories.has(category));
  const remainingCategories = [...productCategories].filter(category => category !== "Tanpa kategori" && !orderedCategories.includes(category));
  const categories = ["Semua", ...orderedCategories, ...remainingCategories, ...(productCategories.has("Tanpa kategori") ? ["Tanpa kategori"] : [])];

  const [activeCategory, setActiveCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus({ preventScroll: true });
  }, [autoFocusSearch]);

  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredProducts = products.filter(product => {
    const categoryMatches = activeCategory === "Semua"
      || (product.category || "Tanpa kategori") === activeCategory;
    const textMatches = !normalizedQuery
      || `${product.name} ${product.category} ${product.description}`
        .toLocaleLowerCase("id-ID")
        .includes(normalizedQuery);
    return categoryMatches && textMatches;
  });

  return (
    <>
      <label className="catalog-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Cari produk</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama, kategori, atau manfaat produk…"
          autoComplete="off"
        />
      </label>
      <div className="filter-row" aria-label="Kategori produk">
        {categories.map(category => (
          <button
            key={category}
            type="button"
            className={`filter-chip ${activeCategory === category ? "active" : ""}`}
            aria-pressed={activeCategory === category}
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
      {filteredProducts.length === 0 && (
        <div className="catalog-empty" role="status">
          <strong>Produk tidak ditemukan</strong>
          <p>Coba kata kunci lain atau pilih kategori “Semua”.</p>
        </div>
      )}
    </>
  );
}
