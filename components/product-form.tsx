"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import type { ProductFormInitial, ProductFormVariant } from "@/lib/product-data";

type Category = { id: string; name: string };

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((item): item is string => Boolean(item)))];
}

function skuPart(value: string) {
  return value.toUpperCase().normalize("NFKD").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "ITEM";
}

function safeNumber(value: string, fallback = 0) {
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function jsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error(`Server mengembalikan respons tidak valid (${response.status})`); }
}

function blankVariant(template: ProductFormVariant, name: string, option1Value: string | null, option2Value: string | null): ProductFormVariant {
  return {
    sku: [skuPart(name), option1Value && skuPart(option1Value), option2Value && skuPart(option2Value)].filter(Boolean).join("-"),
    option1Value,
    option2Value,
    price: template.price,
    stock: 0,
    reserved: 0,
    weight: template.weight || 100,
    length: template.length,
    width: template.width,
    height: template.height,
    lowStockThreshold: template.lowStockThreshold,
    active: true,
  };
}

export function ProductForm({ initial, categories }: { initial: ProductFormInitial; categories: Category[] }) {
  const [name, setName] = useState(initial.name);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState(initial.status);
  const [hasVariants, setHasVariants] = useState(initial.hasVariants);
  const [option1Name, setOption1Name] = useState(initial.option1Name || "Jenis");
  const [option2Name, setOption2Name] = useState(initial.option2Name || "");
  const [option1Values, setOption1Values] = useState(() => unique(initial.variants.map(item => item.option1Value)).length ? unique(initial.variants.map(item => item.option1Value)) : ["Varian A"]);
  const [option2Values, setOption2Values] = useState(() => unique(initial.variants.map(item => item.option2Value)));
  const [newOption1, setNewOption1] = useState("");
  const [newOption2, setNewOption2] = useState("");
  const [variants, setVariants] = useState(initial.variants);
  const [images, setImages] = useState(initial.images);
  const [shopeeLink, setShopeeLink] = useState(initial.shopeeLink || "");
  const [tiktokLink, setTiktokLink] = useState(initial.tiktokLink || "");
  const [tokopediaLink, setTokopediaLink] = useState(initial.tokopediaLink || "");
  const [rating, setRating] = useState(String(initial.rating !== undefined ? initial.rating : 5.0));
  const [sold, setSold] = useState(String(initial.sold !== undefined ? initial.sold : 0));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isEdit = Boolean(initial.id);
  const level2Enabled = Boolean(option2Name);
  const activeVariants = useMemo(() => variants.filter(item => item.active), [variants]);

  function rebuild(nextLevel1: string[], nextLevel2: string[], nextHasVariants = hasVariants, nextLevel2Enabled = Boolean(option2Name)) {
    if (!nextHasVariants) {
      const first = variants[0];
      setVariants([{ ...(first ?? blankVariant(initial.variants[0], name, null, null)), option1Value: null, option2Value: null, active: true }]);
      return;
    }
    const secondValues: Array<string | null> = nextLevel2Enabled ? nextLevel2 : [null];
    const template = variants[0] ?? initial.variants[0];
    const next = nextLevel1.flatMap(first => secondValues.map(second => {
      const existing = variants.find(item => item.option1Value === first && item.option2Value === second);
      return existing ? { ...existing, active: true } : blankVariant(template, name, first, second);
    }));
    setVariants(next);
  }

  function toggleVariants(enabled: boolean) {
    setHasVariants(enabled);
    if (enabled) {
      const values = option1Values.length ? option1Values : ["Varian A"];
      setOption1Values(values);
      rebuild(values, option2Values, true, Boolean(option2Name));
    } else {
      setOption2Name("");
      rebuild([], [], false, false);
    }
  }

  function addOption(level: 1 | 2) {
    const value = (level === 1 ? newOption1 : newOption2).trim();
    if (!value) return;
    if (level === 1) {
      if (option1Values.some(item => item.toLowerCase() === value.toLowerCase())) return setMessage("Nilai Tingkat I sudah ada.");
      const next = [...option1Values, value]; setOption1Values(next); setNewOption1(""); rebuild(next, option2Values);
    } else {
      if (option2Values.some(item => item.toLowerCase() === value.toLowerCase())) return setMessage("Nilai Tingkat II sudah ada.");
      const next = [...option2Values, value]; setOption2Values(next); setNewOption2(""); rebuild(option1Values, next);
    }
  }

  function removeOption(level: 1 | 2, value: string) {
    if (level === 1) {
      if (option1Values.length === 1) return setMessage("Tingkat I minimal memiliki satu nilai.");
      const next = option1Values.filter(item => item !== value); setOption1Values(next); rebuild(next, option2Values);
    } else {
      if (option2Values.length === 1) return setMessage("Tingkat II minimal memiliki satu nilai selama aktif.");
      const next = option2Values.filter(item => item !== value); setOption2Values(next); rebuild(option1Values, next);
    }
  }

  function updateVariant(index: number, patch: Partial<ProductFormVariant>) {
    setVariants(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 10) return setMessage("Maksimal 10 gambar per produk.");
    setUploading(true); setMessage("");
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData(); form.set("scope", "products"); form.set("file", file);
        const response = await fetch("/api/admin/media/upload-url", { method: "POST", body: form });
        const result = await jsonResponse(response);
        if (!response.ok || typeof result.path !== "string") throw new Error(typeof result.error === "string" ? result.error : `Gambar ${file.name} gagal diunggah`);
        uploaded.push(result.path);
      }
      setImages(current => [...current, ...uploaded]);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Upload gambar gagal"); }
    finally { setUploading(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const payload = {
        name, categoryId: categoryId || null, description, status, hasVariants,
        option1Name: hasVariants ? option1Name.trim() || null : null,
        option2Name: hasVariants ? option2Name.trim() || null : null,
        images,
        variants: variants.map(item => ({ ...item, option1Value: hasVariants ? item.option1Value : null, option2Value: hasVariants && option2Name ? item.option2Value : null })),
        shopeeLink: shopeeLink.trim() || null,
        tiktokLink: tiktokLink.trim() || null,
        tokopediaLink: tokopediaLink.trim() || null,
        rating: safeNumber(rating),
        sold: safeNumber(sold),
      };
      const response = await fetch(initial.id ? `/api/admin/products/${encodeURIComponent(initial.id)}` : "/api/admin/products", { method: initial.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Produk gagal disimpan");
      window.location.href = "/admin/products";
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Produk gagal disimpan"); setBusy(false); }
  }

  return <form className="admin-content" onSubmit={submit} noValidate>
    <div className="admin-page-head"><div><Link href="/admin/products" className="eyebrow admin-back"><ChevronLeft size={13}/> Kembali ke produk</Link><h1>{isEdit ? "Edit produk" : "Tambah produk"}</h1><p>Kelola informasi, media, dan kombinasi penjualan produk.</p></div><button className="button button-dark" disabled={busy || uploading || activeVariants.length === 0}><Save size={15}/> {busy ? "Menyimpan…" : "Simpan produk"}</button></div>
    {message && <p role="alert" className="panel form-message">{message}</p>}
    <div className="admin-detail-grid product-editor-grid"><div>
      <section className="admin-section"><h2>Informasi dasar</h2><div className="field-grid">
        <div className="field full"><label>Nama produk</label><input value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={180} placeholder="Contoh: Kayu Manis Batang Premium"/></div>
        <div className="field"><label>Kategori</label><select value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Tanpa kategori</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label>Status</label><select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="draft">Draft</option><option value="active">Aktif</option><option value="archived">Diarsipkan</option></select></div>
        <div className="field"><label>Rating (Maks 5.0)</label><input type="number" min="0" max="5" step="0.1" value={rating} onChange={event => setRating(event.target.value)} required placeholder="Contoh: 4.9"/></div>
        <div className="field"><label>Jumlah Terjual</label><input type="number" min="0" step="1" value={sold} onChange={event => setSold(event.target.value)} required placeholder="Contoh: 1250"/></div>
        <div className="field full"><label>Deskripsi</label><textarea value={description} onChange={event => setDescription(event.target.value)} required minLength={10} maxLength={20000} placeholder="Asal, aroma, kualitas, cara penggunaan, dan informasi produk…"/></div>
      </div></section>
      <section className="admin-section"><div className="section-inline-head"><div><h2>Media lokal</h2><p>Maksimal 10 gambar. Gambar pertama menjadi gambar utama.</p></div><label className="button button-light"><ImagePlus size={16}/> {uploading ? "Mengunggah…" : "Tambah gambar"}<input hidden type="file" multiple disabled={uploading || images.length >= 10} accept="image/jpeg,image/png,image/webp" onChange={event => uploadFiles(event.target.files)}/></label></div>
        {images.length ? <div className="local-media-grid">{images.map((path, index) => <div key={path} className="local-media-item"><Image unoptimized src={path} alt={`${name || "Produk"} ${index + 1}`} fill/><span>{index === 0 ? "Utama" : index + 1}</span><button type="button" aria-label="Hapus gambar" onClick={() => setImages(current => current.filter(item => item !== path))}><Trash2 size={14}/></button></div>)}</div> : <p className="empty-hint">Belum ada gambar. JPG, PNG, atau WebP maksimal 5 MB per file.</p>}
      </section>
      <section className="admin-section">
        <h2>Link Toko Online</h2>
        <div className="field-grid">
          <div className="field full">
            <label>Shopee Link</label>
            <input type="url" value={shopeeLink} onChange={event => setShopeeLink(event.target.value)} placeholder="https://shopee.co.id/..."/>
          </div>
          <div className="field full">
            <label>TikTok Link</label>
            <input type="url" value={tiktokLink} onChange={event => setTiktokLink(event.target.value)} placeholder="https://www.tiktok.com/..."/>
          </div>
          <div className="field full">
            <label>Tokopedia Link</label>
            <input type="url" value={tokopediaLink} onChange={event => setTokopediaLink(event.target.value)} placeholder="https://www.tokopedia.com/..."/>
          </div>
        </div>
      </section>
    </div><aside><section className="admin-section"><div className="section-inline-head"><div><h2>Informasi penjualan</h2><p>Pilih produk tunggal atau maksimal dua tingkat variasi.</p></div><label className="switch-control"><input type="checkbox" checked={hasVariants} onChange={event => toggleVariants(event.target.checked)}/><span/>Dengan varian</label></div>
      {hasVariants && <div className="variant-levels"><div className="variant-level"><div className="field"><label>Nama Tingkat I</label><input value={option1Name} onChange={event => setOption1Name(event.target.value)} required placeholder="Contoh: Jenis"/></div><div className="option-add"><input value={newOption1} onChange={event => setNewOption1(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addOption(1); } }} placeholder="Tambah nilai"/><button type="button" aria-label="Tambah nilai tingkat pertama" onClick={() => addOption(1)}><Plus size={14}/></button></div><div className="option-chips">{option1Values.map(value => <span key={value}>{value}<button type="button" aria-label={`Hapus nilai ${value}`} onClick={() => removeOption(1, value)}>×</button></span>)}</div></div>
        <div className="variant-level"><label className="switch-control compact"><input type="checkbox" checked={level2Enabled} onChange={event => { const enabled = event.target.checked; setOption2Name(enabled ? "Berat Bersih" : ""); if (enabled) { const values = option2Values.length ? option2Values : ["100 g"]; setOption2Values(values); rebuild(option1Values, values, true, true); } else { rebuild(option1Values, [], true, false); } }}/><span/>Aktifkan Tingkat II</label>{level2Enabled && <><div className="field"><label>Nama Tingkat II</label><input value={option2Name} onChange={event => setOption2Name(event.target.value)} required placeholder="Contoh: Berat bersih"/></div><div className="option-add"><input value={newOption2} onChange={event => setNewOption2(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addOption(2); } }} placeholder="Tambah nilai"/><button type="button" aria-label="Tambah nilai tingkat kedua" onClick={() => addOption(2)}><Plus size={14}/></button></div><div className="option-chips">{option2Values.map(value => <span key={value}>{value}<button type="button" aria-label={`Hapus nilai ${value}`} onClick={() => removeOption(2, value)}>×</button></span>)}</div></>}</div>
      </div>}
    </section></aside></div>
    <section className="admin-section"><div className="section-inline-head"><div><h2>Daftar detail {hasVariants ? "variasi" : "produk"}</h2><p>Dimensi paket P × L × T bersifat opsional; bila dipakai harus diisi lengkap dalam sentimeter.</p></div><span className="status-pill">{variants.length} kombinasi</span></div>
      <div className="admin-table-wrap"><table className="admin-table variant-table"><thead><tr>{hasVariants && <th>Variasi</th>}<th>Foto</th><th>SKU</th><th>Harga</th><th>Stok fisik</th><th>Berat (g)</th><th>P × L × T (cm)</th><th>Stok menipis</th><th>Aktif</th></tr></thead><tbody>{variants.map((variant, index) => <tr key={`${variant.id ?? "new"}-${variant.option1Value}-${variant.option2Value}`}>
        {hasVariants && <td><strong>{[variant.option1Value, variant.option2Value].filter(Boolean).join(" / ")}</strong></td>}
        <td>
          <div className="variant-photo-cell">
            {variant.imageKey ? (
              <div className="variant-photo-thumb">
                <Image unoptimized src={variant.imageKey} alt="Foto varian" fill />
                <button type="button" className="variant-photo-remove" aria-label="Hapus foto varian" onClick={() => updateVariant(index, { imageKey: null })}>×</button>
              </div>
            ) : (
              <label className="button button-light variant-photo-upload">
                <ImagePlus size={12} />
                <span>+</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={async (event) => {
                    const files = event.target.files;
                    if (!files?.length) return;
                    const file = files[0];
                    const form = new FormData();
                    form.set("scope", "products");
                    form.set("file", file);
                    try {
                      const response = await fetch("/api/admin/media/upload-url", { method: "POST", body: form });
                      const result = await jsonResponse(response);
                      if (!response.ok || typeof result.path !== "string") {
                        throw new Error(typeof result.error === "string" ? result.error : "Gagal mengunggah foto varian");
                      }
                      updateVariant(index, { imageKey: result.path });
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Gagal mengunggah foto varian");
                    }
                  }}
                />
              </label>
            )}
          </div>
        </td>
        <td><input required value={variant.sku} maxLength={80} onChange={event => updateVariant(index, { sku: event.target.value })}/></td>
        <td><input required type="number" min="1" step="1" value={variant.price || ""} onChange={event => updateVariant(index, { price: safeNumber(event.target.value) })}/></td>
        <td><input required type="number" min={variant.reserved} step="1" value={variant.stock} onChange={event => updateVariant(index, { stock: safeNumber(event.target.value) })}/>{variant.reserved > 0 && <small>{variant.reserved} direservasi</small>}</td>
        <td><input required type="number" min="1" step="1" value={variant.weight || ""} onChange={event => updateVariant(index, { weight: safeNumber(event.target.value) })}/></td>
        <td><div className="dimension-inputs">{(["length", "width", "height"] as const).map(field => <input key={field} aria-label={field} type="number" min="1" step="1" value={variant[field] ?? ""} onChange={event => updateVariant(index, { [field]: event.target.value === "" ? null : safeNumber(event.target.value) })}/>)}</div></td>
        <td><input required type="number" min="0" step="1" value={variant.lowStockThreshold} onChange={event => updateVariant(index, { lowStockThreshold: safeNumber(event.target.value) })}/></td>
        <td><input type="checkbox" checked={variant.active} onChange={event => updateVariant(index, { active: event.target.checked })}/></td>
      </tr>)}</tbody></table></div>
    </section>
  </form>;
}
