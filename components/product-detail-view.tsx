"use client";
import React from "react";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, RotateCcw, ShieldCheck, ShoppingBag } from "lucide-react";
import { rupiah } from "@/lib/format";
import type { Product } from "@/lib/types";

function distinct(values: Array<string | undefined>) {
  return [...new Set(values.filter((item): item is string => Boolean(item)))];
}

/** Render deskripsi produk: bold, italic, heading, list, enter, hr */
function renderDescription(text: string) {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (!listItems.length) return;
    if (listType === "ol") {
      elements.push(
        <ol key={`ol-${elements.length}`}>
          {listItems.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />)}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {listItems.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />)}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList();
      elements.push(<hr key={`hr-${i}`} />);
      continue;
    }
    // h3
    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={`h3-${i}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.slice(4)) }} />);
      continue;
    }
    // h2
    if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={`h2-${i}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.slice(3)) }} />);
      continue;
    }
    // h1
    if (line.startsWith("# ")) {
      flushList();
      elements.push(<h2 key={`h1-${i}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.slice(2)) }} />);
      continue;
    }
    // ordered list
    if (/^\d+[.)]\s/.test(line)) {
      const content = line.replace(/^\d+[.)]\s+/, "");
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listItems.push(content);
      continue;
    }
    // unordered list (-, *, +)
    if (/^[-*+]\s/.test(line)) {
      const content = line.replace(/^[-*+]\s+/, "");
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(content);
      continue;
    }
    // blank line
    if (line.trim() === "") {
      flushList();
      continue;
    }
    // normal paragraph line
    flushList();
    elements.push(<p key={`p-${i}`} dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />);
  }
  flushList();
  return elements;
}

/** Inline markdown: **bold**, *italic*, `code` */
function inlineMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function ProductDetailView({ product }: { product: Product }) {
  // Variant Selection State
  const [option1, setOption1] = useState<string | undefined>(undefined);
  const [option2, setOption2] = useState<string | undefined>(undefined);
  const [added, setAdded] = useState(false);
  const [addedVariantText, setAddedVariantText] = useState("");
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const option1Values = useMemo(() => distinct(product.variants.map(item => item.option1Value)), [product.variants]);
  const option2Values = useMemo(() => {
    if (!option1) return distinct(product.variants.map(item => item.option2Value));
    return distinct(product.variants.filter(item => item.option1Value === option1).map(item => item.option2Value));
  }, [product.variants, option1]);

  const hasSelectedAllOptions = !product.hasVariants || (
    option1 !== undefined && 
    (!product.option2Name || option2 !== undefined)
  );

  const selected = hasSelectedAllOptions
    ? product.variants.find(item => 
        (!product.hasVariants || item.option1Value === option1) && 
        (!product.option2Name || item.option2Value === option2)
      )
    : undefined;

  const soldOut = selected ? selected.stock <= 0 : false;
  const isPurchaseDisabled = !selected || soldOut;

  const prices = product.variants.map(v => v.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : product.price;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : product.price;

  // Image Slider State
  const [currentIndex, setCurrentIndex] = useState(() => selected?.imageKey
    ? Math.max(0, product.images.indexOf(selected.imageKey))
    : 0);

  function showVariantImage(imageKey?: string) {
    if (!imageKey) return;
    const index = product.images.indexOf(imageKey);
    if (index >= 0) setCurrentIndex(index);
  }

  function chooseFirst(value: string) {
    setOption1(value);
    const candidates = product.variants.filter(item => item.option1Value === value);
    const next = candidates.find(item => item.stock > 0) ?? candidates[0];
    if (product.option2Name) {
      setOption2(undefined);
    }
    showVariantImage(next?.imageKey);
  }

  function chooseSecond(value: string) {
    setOption2(value);
    const next = product.variants.find(item => item.option1Value === option1 && item.option2Value === value);
    showVariantImage(next?.imageKey);
  }

  function addToCart() {
    if (!selected) return;
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
      
      const variantText = product.hasVariants ? ` · ${[selected.option1Value, selected.option2Value].filter(Boolean).join(" / ")}` : "";
      setAddedVariantText(variantText);
      setAdded(true);
      
      window.dispatchEvent(new Event("cart-updated"));

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setAdded(false);
      }, 4000);
    } catch {
      setAdded(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setAdded(false);
      }, 4000);
    }
  }

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === product.images.length - 1 ? 0 : prev + 1));
  };

  return (
    <main className="product-page">
      <section className="product-gallery-container" aria-label="Galeri produk">
        <div className="product-slider-container">
          <div 
            className="product-slider-track" 
            style={{ 
              width: `${product.images.length * 100}%`,
              transform: `translateX(-${(currentIndex * 100) / product.images.length}%)` 
            }}
          >
            {product.images.map((image, index) => (
              <div 
                key={image} 
                className="product-slider-slide"
                style={{ width: `${100 / product.images.length}%` }}
              >
                <Image 
                  unoptimized 
                  src={image} 
                  alt={`${product.name} gambar ${index + 1}`} 
                  fill 
                  priority={index === 0} 
                  sizes="(max-width: 760px) 100vw, 40vw"
                />
              </div>
            ))}
          </div>

          {product.images.length > 1 && (
            <>
              <button 
                type="button" 
                onClick={handlePrev} 
                className="slider-arrow slider-arrow-left" 
                aria-label="Gambar sebelumnya"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                type="button" 
                onClick={handleNext} 
                className="slider-arrow slider-arrow-right" 
                aria-label="Gambar berikutnya"
              >
                <ChevronRight size={20} />
              </button>
              <div className="slider-dots">
                {product.images.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`slider-dot ${index === currentIndex ? "active" : ""}`}
                    aria-label={`Lihat gambar ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <aside className="product-details">
        <div className="mall-badges">
          <Image src="/shopee-mall.webp" alt="Shopee Mall" width={87} height={26} className="mall-badge" />
          <Image src="/tiktok-mall.webp" alt="TikTok Mall" width={87} height={26} className="mall-badge" />
        </div>
        <p className="eyebrow">100% Rempah Asli Nusantara</p>
        <h1>{product.name}</h1>
        <div className="product-rating">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>
          <strong>{product.rating.toFixed(1)}</strong>
          <span>{product.sold >= 1000 ? `${Math.floor(product.sold / 1000)}rb` : product.sold} terjual</span>
        </div>
        <p className="product-main-price">
          {selected ? (
            <>
              {rupiah(selected.price)}
              {selected.compareAt && <s>{rupiah(selected.compareAt)}</s>}
            </>
          ) : (
            <>
              {minPrice !== maxPrice ? (
                `${rupiah(minPrice)} - ${rupiah(maxPrice)}`
              ) : (
                <>
                  {rupiah(minPrice)}
                  {product.compareAt && <s>{rupiah(product.compareAt)}</s>}
                </>
              )}
            </>
          )}
        </p>
        <div className="product-desc">{renderDescription(product.description)}</div>

        <div className="purchase-block">
          {product.hasVariants && product.option1Name && (
            <>
              <div className="option-label">{product.option1Name}<span>{option1}</span></div>
              <div className="size-options">
                {option1Values.map(value => {
                  const available = product.variants.some(item => item.option1Value === value && item.stock > 0);
                  return (
                    <button 
                      type="button" 
                      key={value} 
                      disabled={!available} 
                      className={`size-option ${option1 === value ? "active" : ""}`} 
                      onClick={() => chooseFirst(value)} 
                      aria-pressed={option1 === value}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {product.hasVariants && product.option2Name && (
            <>
              <div className="option-label">{product.option2Name}<span>{option2}</span></div>
              <div className="size-options">
                {option2Values.map(value => {
                  const variant = product.variants.find(item => item.option1Value === option1 && item.option2Value === value);
                  return (
                    <button 
                      type="button" 
                      key={value} 
                      disabled={!variant?.stock} 
                      className={`size-option ${option2 === value ? "active" : ""}`} 
                      onClick={() => chooseSecond(value)} 
                      aria-pressed={option2 === value}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {selected && (
            <div className={`selected-variant-summary ${soldOut ? "stock-out" : selected.stock <= 5 ? "stock-low" : ""}`}>
              {soldOut ? (
                <>
                  <AlertTriangle size={14}/>
                  <span>Stok habis</span>
                </>
              ) : (
                <>
                  <Check size={14}/>
                  <span>Tersedia · {selected.stock} item tersisa</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="purchase-actions">
          <button type="button" className="button button-light" disabled={isPurchaseDisabled} onClick={addToCart}>
            <ShoppingBag size={17}/> Tambah
          </button>
          <Link 
            aria-disabled={isPurchaseDisabled} 
            className={`button button-dark ${isPurchaseDisabled ? "disabled" : ""}`} 
            href={isPurchaseDisabled ? "#" : `/checkout?variant=${encodeURIComponent(selected?.id || "")}`}
          >
            Beli sekarang
          </Link>
        </div>

        {added && (
          <div className="add-confirmation" role="status">
            {product.name}{addedVariantText} masuk ke keranjang.
          </div>
        )}

        <div className="micro-benefits">
          <div><ShieldCheck size={17}/><span>Pembayaran QRIS aman</span></div>
          <div><RotateCcw size={17}/><span>Retur 7 hari via aplikasi</span></div>
        </div>

        <div className="detail-accordion">
          <details open><summary>Penyimpanan & penggunaan</summary><ul>{product.care.map(item => <li key={item}>{item}</li>)}</ul></details>
          <details><summary>Pengiriman</summary><p>Tarif dan estimasi dihitung dari alamat Anda saat checkout. Resi dan tracking tersedia langsung dari halaman pesanan.</p></details>
          <details><summary>Retur & refund</summary><p>Ajukan masalah dari halaman pesanan dalam 7 hari setelah barang diterima. Refund akan diproses setelah investigasi.</p></details>
        </div>
        {Boolean(product.shopeeLink || product.tiktokLink || product.tokopediaLink) && (
          <div className="external-store-links">
            <p>Tersedia juga di:</p>
            <div className="external-links-grid">
              {product.shopeeLink && (
                <a href={product.shopeeLink} target="_blank" rel="noopener noreferrer" className="external-link-icon" aria-label="Beli di Shopee">
                  <Image src="/icon-shopee.webp" alt="Shopee" width={36} height={36} />
                </a>
              )}
              {product.tiktokLink && (
                <a href={product.tiktokLink} target="_blank" rel="noopener noreferrer" className="external-link-icon" aria-label="Beli di TikTok">
                  <Image src="/icon-tiktok.webp" alt="TikTok" width={36} height={36} />
                </a>
              )}
              {product.tokopediaLink && (
                <a href={product.tokopediaLink} target="_blank" rel="noopener noreferrer" className="external-link-icon" aria-label="Beli di Tokopedia">
                  <Image src="/icon-tokped.webp" alt="Tokopedia" width={36} height={36} />
                </a>
              )}
            </div>
          </div>
        )}
      </aside>
    </main>
  );
}
