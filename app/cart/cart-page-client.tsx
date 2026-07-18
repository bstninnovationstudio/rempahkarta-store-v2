"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { rupiah } from "@/lib/format";
import type { Product, StoreVariant } from "@/lib/types";

type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
};

type ResolvedCartItem = CartItem & {
  product: Product;
  variant: StoreVariant;
};

export function CartPageClient({ allProducts }: { allProducts: Product[] }) {
  const [resolvedItems, setResolvedItems] = useState<ResolvedCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function loadCart() {
      try {
        const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]");
        const resolved = cart.map(item => {
          const product = allProducts.find(p => p.id === item.productId);
          const variant = product?.variants.find(v => v.id === item.variantId);
          if (product && variant) {
            return {
              ...item,
              product,
              variant
            };
          }
          return null;
        }).filter((item): item is ResolvedCartItem => item !== null);
        setResolvedItems(resolved);
      } catch {
        setResolvedItems([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadCart();
    window.addEventListener("cart-updated", loadCart);
    return () => window.removeEventListener("cart-updated", loadCart);
  }, [allProducts]);

  const updateQuantity = (variantId: string, delta: number) => {
    const updated = resolvedItems.map(item => {
      if (item.variantId === variantId) {
        const newQty = Math.max(1, Math.min(item.variant.stock, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    });
    setResolvedItems(updated);
    saveCart(updated);
  };

  const removeItem = (variantId: string) => {
    const filtered = resolvedItems.filter(item => item.variantId !== variantId);
    setResolvedItems(filtered);
    saveCart(filtered);
  };

  const handleOptionChange = (item: ResolvedCartItem, optIndex: number, newValue: string) => {
    const product = item.product;
    const current = item.variant;

    let targetOpt1 = current.option1Value;
    let targetOpt2 = current.option2Value;

    if (optIndex === 1) {
      targetOpt1 = newValue;
      if (product.option2Name) {
        const matches = product.variants.filter(v => v.option1Value === targetOpt1);
        const matchesOpt2 = matches.find(v => v.option2Value === targetOpt2);
        if (!matchesOpt2) {
          targetOpt2 = matches[0]?.option2Value;
        }
      }
    } else if (optIndex === 2) {
      targetOpt2 = newValue;
    }

    const targetVariant = product.variants.find(v => 
      (!product.option1Name || v.option1Value === targetOpt1) &&
      (!product.option2Name || v.option2Value === targetOpt2)
    );

    if (targetVariant) {
      const duplicate = resolvedItems.find(resolved => resolved.variantId === targetVariant.id && resolved.variantId !== item.variantId);
      
      let updated: ResolvedCartItem[];
      if (duplicate) {
        updated = resolvedItems.map(resolved => {
          if (resolved.variantId === duplicate.variantId) {
            return {
              ...resolved,
              quantity: Math.min(targetVariant.stock, resolved.quantity + item.quantity)
            };
          }
          return resolved;
        }).filter(resolved => resolved.variantId !== item.variantId);
      } else {
        updated = resolvedItems.map(resolved => {
          if (resolved.variantId === item.variantId) {
            return {
              ...resolved,
              variantId: targetVariant.id,
              variant: targetVariant,
              quantity: Math.min(resolved.quantity, targetVariant.stock)
            };
          }
          return resolved;
        });
      }
      setResolvedItems(updated);
      saveCart(updated);
    }
  };

  const saveCart = (items: ResolvedCartItem[]) => {
    const cartData = items.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity
    }));
    localStorage.setItem("cart", JSON.stringify(cartData));
    window.dispatchEvent(new Event("cart-updated"));
  };

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const totalWeight = resolvedItems.reduce((sum, item) => sum + (item.variant.weight || 0) * item.quantity, 0);
  const formattedWeight = totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} kg` : `${totalWeight} g`;

  if (isLoading) {
    return (
      <main className="simple-page">
        <div className="page-title">
          <p className="eyebrow">Memuat...</p>
          <h1>Keranjang</h1>
        </div>
      </main>
    );
  }

  if (resolvedItems.length === 0) {
    return (
      <main className="simple-page">
        <div className="page-title">
          <p className="eyebrow">Belanja Anda</p>
          <h1>Keranjang</h1>
        </div>
        <div className="empty-state">
          <p>Keranjang Anda kosong.</p>
          <Link href="/" className="button button-dark">Belanja Sekarang</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="simple-page">
      <div className="page-title">
        <p className="eyebrow">Belanja Anda</p>
        <h1>Keranjang</h1>
      </div>
      <div className="checkout-layout">
        <div className="cart-list">
          {resolvedItems.map(item => {
            const opt1Values = [...new Set(item.product.variants.map(v => v.option1Value).filter((v): v is string => Boolean(v)))];
            const opt2Values = [...new Set(item.product.variants.filter(v => v.option1Value === item.variant.option1Value).map(v => v.option2Value).filter((v): v is string => Boolean(v)))];
            return (
              <article key={item.variantId} className="panel cart-item-card">
                <div className="cart-item-content">
                  <div className="cart-item-media">
                    <Image unoptimized src={item.product.image} alt={item.product.name} fill />
                  </div>
                  <div className="cart-item-body">
                    <div className="cart-item-info">
                      <div className="cart-item-title-wrapper">
                        <p className="eyebrow">{item.product.category}</p>
                        <h2 className="cart-item-title">{item.product.name}</h2>
                      </div>
                      
                      {item.product.hasVariants ? (
                        <div className="cart-options">
                          {item.product.option1Name && (
                            <label className="cart-option-field">
                              <span>{item.product.option1Name}</span>
                              <select
                                value={item.variant.option1Value || ""}
                                onChange={e => handleOptionChange(item, 1, e.target.value)}
                              >
                                {opt1Values.map(val => (
                                  <option key={val} value={val}>{val}</option>
                                ))}
                              </select>
                            </label>
                          )}

                          {item.product.option2Name && (
                            <label className="cart-option-field">
                              <span>{item.product.option2Name}</span>
                              <select
                                value={item.variant.option2Value || ""}
                                onChange={e => handleOptionChange(item, 2, e.target.value)}
                              >
                                {opt2Values.map(val => (
                                  <option key={val} value={val}>{val}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="cart-item-actions">
                      <div className="cart-item-price-group">
                        <span>Harga unit</span>
                        <strong className="cart-item-price">{rupiah(item.variant.price)}</strong>
                      </div>
                      
                      <div className="quantity-control" aria-label={`Jumlah ${item.product.name}`}>
                        <button
                          type="button"
                          className="quantity-button"
                          aria-label="Kurangi jumlah"
                          disabled={item.quantity <= 1}
                          onClick={() => updateQuantity(item.variantId, -1)}
                        >
                          <Minus size={14}/>
                        </button>
                        <span className="quantity-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="quantity-button"
                          aria-label="Tambah jumlah"
                          disabled={item.quantity >= item.variant.stock}
                          onClick={() => updateQuantity(item.variantId, 1)}
                        >
                          <Plus size={14}/>
                        </button>
                        <button
                          type="button"
                          className="quantity-button remove"
                          aria-label="Hapus item"
                          onClick={() => removeItem(item.variantId)}
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="order-summary cart-summary">
          <h2>Ringkasan</h2>
          <div className="summary-lines">
            <div className="summary-line">
              <span>Subtotal</span>
              <span>{rupiah(subtotal)}</span>
            </div>
            <div className="summary-line">
              <span>Total Berat</span>
              <span>{formattedWeight}</span>
            </div>

            <div className="summary-line total">
              <span>Total sementara</span>
              <span>{rupiah(subtotal)}</span>
            </div>
          </div>
          <Link href="/checkout?from=cart" className="button button-dark button-block summary-checkout-button">
            Lanjut checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}
