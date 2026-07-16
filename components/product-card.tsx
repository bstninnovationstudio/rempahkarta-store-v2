import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { rupiah } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const discount = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  return <article className="product-card"><Link href={`/products/${product.slug}`} className="product-image-wrap"><Image unoptimized src={product.image} alt={`${product.name} ${product.color}`} fill sizes="(max-width: 768px) 50vw, 25vw" className="product-image" />{product.tag && <span className="product-tag">{product.tag}</span>}</Link><div className="product-card-info"><p className="eyebrow">{product.category}</p><Link href={`/products/${product.slug}`}><h3>{product.name}</h3></Link><div className="product-price-row"><strong>{rupiah(product.price)}</strong>{product.compareAt && <><s>{rupiah(product.compareAt)}</s><span>-{discount}%</span></>}</div><div className="product-proof"><Star size={13} fill="currentColor"/><span>{product.rating.toFixed(1)}</span><span>· {product.sold >= 1000 ? `${Math.floor(product.sold / 1000)}rb` : product.sold} terjual</span></div></div></article>;
}
