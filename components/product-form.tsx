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

  const mediaDisabled = uploading || images.length >= 10;
  const saveDisabled = busy || uploading || activeVariants.length === 0;

  return (
    <form className="admin-content product-editor" onSubmit={submit} noValidate aria-busy={busy || uploading}>
      <div className="admin-page-head">
        <div>
          <Link href="/admin/products" className="eyebrow admin-back"><ChevronLeft size={13}/> Kembali ke produk</Link>
          <h1>{isEdit ? "Edit produk" : "Tambah produk"}</h1>
          <p>Kelola informasi, media, variasi, harga, dan ketersediaan produk.</p>
        </div>
      </div>

      {message && <p id="product-form-message" role="alert" className="panel form-message" tabIndex={-1}>{message}</p>}

      <div className="admin-detail-grid product-editor-grid">
        <div className="product-editor-main">
          <section className="admin-section" aria-labelledby="product-basic-title">
            <h2 id="product-basic-title">Informasi dasar</h2>
            <div className="field-grid">
              <div className="field full">
                <label htmlFor="product-name">Nama produk</label>
                <input id="product-name" value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={180} placeholder="Contoh: Kayu Manis Batang Premium"/>
              </div>
              <div className="field">
                <label htmlFor="product-category">Kategori</label>
                <select id="product-category" value={categoryId} onChange={event => setCategoryId(event.target.value)}>
                  <option value="">Tanpa kategori</option>
                  {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="product-status">Status publikasi</label>
                <select id="product-status" value={status} onChange={event => setStatus(event.target.value as typeof status)}>
                  <option value="draft">Draft</option>
                  <option value="active">Aktif</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="product-rating">Rating aktual (maks. 5,0)</label>
                <input id="product-rating" type="number" min="0" max="5" step="0.1" value={rating} onChange={event => setRating(event.target.value)} required placeholder="Contoh: 4.9"/>
                <small>Isi hanya dengan data rating yang benar-benar tercatat.</small>
              </div>
              <div className="field">
                <label htmlFor="product-sold">Jumlah terjual aktual</label>
                <input id="product-sold" type="number" min="0" step="1" value={sold} onChange={event => setSold(event.target.value)} required placeholder="Contoh: 1250"/>
                <small>Gunakan jumlah penjualan yang dapat diverifikasi.</small>
              </div>
              <div className="field full">
                <label htmlFor="product-description">Deskripsi</label>
                <textarea id="product-description" value={description} onChange={event => setDescription(event.target.value)} required minLength={10} maxLength={20000} placeholder="Asal, aroma, kualitas, cara penggunaan, dan informasi produk…"/>
                <small>{description.length.toLocaleString("id-ID")} / 20.000 karakter</small>
              </div>
            </div>
          </section>

          <section className="admin-section" aria-labelledby="product-media-title">
            <div className="section-inline-head">
              <div>
                <h2 id="product-media-title">Media produk</h2>
                <p>Gambar pertama menjadi gambar utama. Format JPG, PNG, atau WebP; maksimal 5 MB per file.</p>
              </div>
              <div className="media-upload-actions">
                <span className="media-count" aria-live="polite">{images.length} / 10 gambar</span>
                <label className={`button button-light${mediaDisabled ? " disabled" : ""}`} aria-disabled={mediaDisabled}>
                  <ImagePlus size={16}/> {uploading ? "Mengunggah…" : images.length >= 10 ? "Batas gambar tercapai" : "Tambah gambar"}
                  <input aria-label="Pilih gambar produk" hidden type="file" multiple disabled={mediaDisabled} accept="image/jpeg,image/png,image/webp" onChange={event => uploadFiles(event.target.files)}/>
                </label>
              </div>
            </div>
            {images.length ? (
              <div className="local-media-grid">
                {images.map((path, index) => (
                  <div key={path} className="local-media-item">
                    <Image unoptimized src={path} alt={`${name || "Produk"}, gambar ${index + 1}${index === 0 ? ", gambar utama" : ""}`} fill/>
                    <span>{index === 0 ? "Utama" : index + 1}</span>
                    <button type="button" className="media-remove-button" aria-label={`Hapus gambar ${index + 1}${index === 0 ? " yang menjadi gambar utama" : ""}`} title="Hapus gambar" onClick={() => setImages(current => current.filter(item => item !== path))}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-hint">Belum ada gambar produk. Tambahkan gambar agar produk mudah dikenali.</p>
            )}
          </section>
        </div>

        <aside className="product-editor-rail" aria-label="Konfigurasi penjualan">
          <section className="admin-section" aria-labelledby="product-sales-title">
            <div className="section-inline-head">
              <div>
                <h2 id="product-sales-title">Informasi penjualan</h2>
                <p>Pilih produk tunggal atau maksimal dua tingkat variasi.</p>
              </div>
              <label className="switch-control" htmlFor="product-has-variants">
                <input id="product-has-variants" type="checkbox" checked={hasVariants} onChange={event => toggleVariants(event.target.checked)}/>
                <span aria-hidden="true"/>Dengan varian
              </label>
            </div>

            {hasVariants && (
              <div className="variant-levels">
                <div className="variant-level">
                  <div className="field">
                    <label htmlFor="product-option-1-name">Nama tingkat I</label>
                    <input id="product-option-1-name" value={option1Name} onChange={event => setOption1Name(event.target.value)} required placeholder="Contoh: Jenis"/>
                  </div>
                  <div className="field option-add-field">
                    <label htmlFor="product-option-1-value">Tambah nilai tingkat I</label>
                    <div className="option-add">
                      <input id="product-option-1-value" value={newOption1} onChange={event => setNewOption1(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addOption(1); } }} placeholder="Contoh: Bubuk"/>
                      <button type="button" aria-label="Tambahkan nilai tingkat I" title="Tambahkan nilai" onClick={() => addOption(1)}><Plus size={14}/></button>
                    </div>
                  </div>
                  <div className="option-chips" aria-label="Nilai tingkat I">
                    {option1Values.map(value => <span key={value}>{value}<button type="button" aria-label={`Hapus nilai ${value} dari tingkat I`} onClick={() => removeOption(1, value)}>×</button></span>)}
                  </div>
                </div>

                <div className="variant-level">
                  <label className="switch-control compact" htmlFor="product-level-2-enabled">
                    <input id="product-level-2-enabled" type="checkbox" checked={level2Enabled} onChange={event => { const enabled = event.target.checked; setOption2Name(enabled ? "Berat Bersih" : ""); if (enabled) { const values = option2Values.length ? option2Values : ["100 g"]; setOption2Values(values); rebuild(option1Values, values, true, true); } else { rebuild(option1Values, [], true, false); } }}/>
                    <span aria-hidden="true"/>Aktifkan tingkat II
                  </label>
                  {level2Enabled && (
                    <>
                      <div className="field">
                        <label htmlFor="product-option-2-name">Nama tingkat II</label>
                        <input id="product-option-2-name" value={option2Name} onChange={event => setOption2Name(event.target.value)} required placeholder="Contoh: Berat bersih"/>
                      </div>
                      <div className="field option-add-field">
                        <label htmlFor="product-option-2-value">Tambah nilai tingkat II</label>
                        <div className="option-add">
                          <input id="product-option-2-value" value={newOption2} onChange={event => setNewOption2(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addOption(2); } }} placeholder="Contoh: 100 g"/>
                          <button type="button" aria-label="Tambahkan nilai tingkat II" title="Tambahkan nilai" onClick={() => addOption(2)}><Plus size={14}/></button>
                        </div>
                      </div>
                      <div className="option-chips" aria-label="Nilai tingkat II">
                        {option2Values.map(value => <span key={value}>{value}<button type="button" aria-label={`Hapus nilai ${value} dari tingkat II`} onClick={() => removeOption(2, value)}>×</button></span>)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="admin-section product-variant-section" aria-labelledby="variant-table-title">
        <div className="section-inline-head">
          <div>
            <h2 id="variant-table-title">Daftar detail {hasVariants ? "variasi" : "produk"}</h2>
            <p id="variant-table-help">Dimensi paket P × L × T bersifat opsional; bila dipakai harus diisi lengkap dalam sentimeter.</p>
          </div>
          <span className="count-badge" aria-label={`${activeVariants.length} dari ${variants.length} kombinasi aktif`}>{activeVariants.length} / {variants.length} aktif</span>
        </div>
        <p className="table-scroll-hint">Geser tabel ke samping untuk melihat dan mengedit seluruh kolom.</p>
        <div className="admin-table-wrap variant-table-region" role="region" aria-labelledby="variant-table-title" aria-describedby="variant-table-help" tabIndex={0}>
          <table className="admin-table variant-table">
            <caption className="table-caption">Rincian SKU, harga, stok, ukuran paket, dan status setiap {hasVariants ? "variasi" : "produk"}.</caption>
            <thead>
              <tr>
                {hasVariants && <th scope="col">Variasi</th>}
                <th scope="col">Foto</th>
                <th scope="col">SKU</th>
                <th scope="col">Harga</th>
                <th scope="col">Stok fisik</th>
                <th scope="col">Berat (g)</th>
                <th scope="col">P × L × T (cm)</th>
                <th scope="col">Batas stok menipis</th>
                <th scope="col">Aktif</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => {
                const variantLabel = [variant.option1Value, variant.option2Value].filter(Boolean).join(" / ") || "produk tunggal";
                return (
                  <tr key={`${variant.id ?? "new"}-${variant.option1Value}-${variant.option2Value}`}>
                    {hasVariants && <th scope="row" className="variant-row-heading"><strong>{variantLabel}</strong></th>}
                    <td>
                      <div className="variant-photo-cell">
                        {variant.imageKey ? (
                          <div className="variant-photo-thumb">
                            <Image unoptimized src={variant.imageKey} alt={`Foto ${variantLabel}`} fill />
                            <button type="button" className="variant-photo-remove" aria-label={`Hapus foto ${variantLabel}`} onClick={() => updateVariant(index, { imageKey: null })}>×</button>
                          </div>
                        ) : (
                          <label className="button button-light variant-photo-upload" aria-label={`Tambah foto ${variantLabel}`}>
                            <ImagePlus size={12}/><span aria-hidden="true">+</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              hidden
                              aria-label={`Pilih foto ${variantLabel}`}
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
                    <td><input required aria-label={`SKU ${variantLabel}`} value={variant.sku} maxLength={80} onChange={event => updateVariant(index, { sku: event.target.value })}/></td>
                    <td><input required aria-label={`Harga ${variantLabel}`} inputMode="numeric" type="number" min="1" step="1" value={variant.price || ""} onChange={event => updateVariant(index, { price: safeNumber(event.target.value) })}/></td>
                    <td><input required aria-label={`Stok fisik ${variantLabel}`} inputMode="numeric" type="number" min={variant.reserved} step="1" value={variant.stock} onChange={event => updateVariant(index, { stock: safeNumber(event.target.value) })}/>{variant.reserved > 0 && <small>{variant.reserved} unit direservasi</small>}</td>
                    <td><input required aria-label={`Berat ${variantLabel} dalam gram`} inputMode="numeric" type="number" min="1" step="1" value={variant.weight || ""} onChange={event => updateVariant(index, { weight: safeNumber(event.target.value) })}/></td>
                    <td>
                      <div className="dimension-inputs">
                        {(["length", "width", "height"] as const).map(field => {
                          const fieldLabel = field === "length" ? "Panjang" : field === "width" ? "Lebar" : "Tinggi";
                          return <input key={field} aria-label={`${fieldLabel} paket ${variantLabel} dalam sentimeter`} inputMode="numeric" type="number" min="1" step="1" value={variant[field] ?? ""} onChange={event => updateVariant(index, { [field]: event.target.value === "" ? null : safeNumber(event.target.value) })}/>;
                        })}
                      </div>
                    </td>
                    <td><input required aria-label={`Batas stok menipis ${variantLabel}`} inputMode="numeric" type="number" min="0" step="1" value={variant.lowStockThreshold} onChange={event => updateVariant(index, { lowStockThreshold: safeNumber(event.target.value) })}/></td>
                    <td><input type="checkbox" aria-label={`Aktifkan ${variantLabel}`} checked={variant.active} onChange={event => updateVariant(index, { active: event.target.checked })}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {activeVariants.length === 0 && <p className="form-error" role="alert">Aktifkan minimal satu detail produk sebelum menyimpan.</p>}
      </section>

      <section className="admin-section product-marketplace-section" aria-labelledby="product-marketplace-title">
        <h2 id="product-marketplace-title">Tautan toko online</h2>
        <p className="section-description">Opsional. Tambahkan tautan langsung ke halaman produk pada marketplace.</p>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="product-shopee-link">Tautan Shopee</label>
            <input id="product-shopee-link" type="url" value={shopeeLink} onChange={event => setShopeeLink(event.target.value)} placeholder="https://shopee.co.id/..."/>
          </div>
          <div className="field full">
            <label htmlFor="product-tiktok-link">Tautan TikTok</label>
            <input id="product-tiktok-link" type="url" value={tiktokLink} onChange={event => setTiktokLink(event.target.value)} placeholder="https://www.tiktok.com/..."/>
          </div>
          <div className="field full">
            <label htmlFor="product-tokopedia-link">Tautan Tokopedia</label>
            <input id="product-tokopedia-link" type="url" value={tokopediaLink} onChange={event => setTokopediaLink(event.target.value)} placeholder="https://www.tokopedia.com/..."/>
          </div>
        </div>
      </section>

      <div className="form-footer-actions product-editor-actions">
        <p>{activeVariants.length} detail aktif siap disimpan.</p>
        <button type="submit" className="button button-dark" disabled={saveDisabled}>
          <Save size={15}/> {busy ? "Menyimpan…" : uploading ? "Menunggu unggahan…" : "Simpan produk"}
        </button>
      </div>
    </form>
  );
}
