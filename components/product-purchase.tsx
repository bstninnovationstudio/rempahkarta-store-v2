"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ShoppingBag } from "lucide-react";
import { rupiah } from "@/lib/format";
import type { Product } from "@/lib/types";

function distinct(values: Array<string | undefined>) {
  return [...new Set(values.filter((item): item is string => Boolean(item)))];
}

export function ProductPurchase({ product }: { product: Product }) {
  const initial = product.variants.find(item => item.stock > 0) ?? product.variants[0];
  const [option1, setOption1] = useState(initial?.option1Value);
  const [option2, setOption2] = useState(initial?.option2Value);
  const [added, setAdded] = useState(false);
  const option1Values = useMemo(() => distinct(product.variants.map(item => item.option1Value)), [product.variants]);
  const option2Values = useMemo(() => distinct(product.variants.filter(item => item.option1Value === option1).map(item => item.option2Value)), [product.variants, option1]);
  const selected = product.variants.find(item => (!product.hasVariants || item.option1Value === option1) && (!product.option2Name || item.option2Value === option2)) ?? initial;
  const soldOut = !selected || selected.stock <= 0;

  function chooseFirst(value: string) {
    setOption1(value);
    const candidates = product.variants.filter(item => item.option1Value === value);
    const next = candidates.find(item => item.stock > 0) ?? candidates[0];
    setOption2(next?.option2Value);
  }

  function addToCart() {
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const existing = cart.find((item: { variantId: string }) => item.variantId === selected.id);
      if (existing) {
        existing.quantity = Math.min(selected.stock, existing.quantity + 1);
      } else {
        cart.push({
          productId: product.id,
          variantId: selected.id,
          quantity: 1,
        });
      }
      localStorage.setItem("cart", JSON.stringify(cart));
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
    } catch {
      setAdded(true);
    }
  }

  return <div className="purchase-block">
    {product.hasVariants && product.option1Name && <><div className="option-label">{product.option1Name}<span>{option1}</span></div><div className="size-options">{option1Values.map(value => {
      const available = product.variants.some(item => item.option1Value === value && item.stock > 0);
      return <button type="button" key={value} disabled={!available} className={`size-option ${option1 === value ? "active" : ""}`} onClick={() => chooseFirst(value)} aria-pressed={option1 === value}>{value}</button>;
    })}</div></>}
    {product.hasVariants && product.option2Name && <><div className="option-label">{product.option2Name}<span>{option2}</span></div><div className="size-options">{option2Values.map(value => {
      const variant = product.variants.find(item => item.option1Value === option1 && item.option2Value === value);
      return <button type="button" key={value} disabled={!variant?.stock} className={`size-option ${option2 === value ? "active" : ""}`} onClick={() => setOption2(value)} aria-pressed={option2 === value}>{value}</button>;
    })}</div></>}
    {selected && <div className="selected-variant-summary"><strong>{rupiah(selected.price)}</strong><span>SKU {selected.sku}</span></div>}
    <p className={`stock-note ${soldOut ? "stock-out" : selected.stock <= 5 ? "stock-low" : ""}`}>{soldOut ? <><AlertTriangle size={12}/> Stok habis</> : <><Check size={12}/> Tersedia · {selected.stock} item tersisa</>}</p>
    <div className="purchase-actions"><button type="button" className="button button-light" disabled={soldOut} onClick={addToCart}><ShoppingBag size={17}/> Tambah</button><Link aria-disabled={soldOut} className={`button button-dark ${soldOut ? "disabled" : ""}`} href={soldOut ? "#" : `/checkout?variant=${encodeURIComponent(selected.id)}`}>Beli sekarang</Link></div>
    {added && <div className="add-confirmation" role="status">{product.name}{product.hasVariants ? ` · ${[selected.option1Value, selected.option2Value].filter(Boolean).join(" / ")}` : ""} masuk ke keranjang.</div>}
  </div>;
}
