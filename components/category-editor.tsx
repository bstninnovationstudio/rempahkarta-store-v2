"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ImageOff, Package, Save, Search } from "lucide-react";

type Product = { id: string; name: string; status: string; categoryId: string | null; selected: boolean; imageKey: string | null };

const productStatusLabels: Record<string, string> = {
  active: "Aktif",
  draft: "Draft",
  archived: "Diarsipkan",
};

function mediaPath(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

export function CategoryEditor({ category, products }: { category: { id: string; name: string; description: string | null }; products: Product[] }) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || "");
  const [selected, setSelected] = useState(() => new Set(products.filter(item => item.selected).map(item => item.id)));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const messageIsSuccess = message.includes("berhasil");
  const availableProducts = useMemo(() => products.filter(item => !item.categoryId || item.categoryId === category.id), [category.id, products]);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return products;
    return products.filter(item => item.name.toLocaleLowerCase("id-ID").includes(normalized));
  }, [products, query]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, productIds: [...selected] }),
      });
      const text = await response.text();
      let result: Record<string, unknown> = {};
      if (text) {
        try {
          result = JSON.parse(text) as Record<string, unknown>;
        } catch {
          throw new Error(`Server mengembalikan halaman yang tidak valid (HTTP ${response.status}). Mulai ulang server development lalu coba lagi.`);
        }
      }
      if (!response.ok) throw new Error(String(result.error || "Kategori gagal disimpan"));
      setMessage("Kategori dan keanggotaan produk berhasil disimpan.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Kategori gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="category-editor" onSubmit={submit} aria-busy={busy}>
      {message && (
        <p role={messageIsSuccess ? "status" : "alert"} className={`form-banner ${messageIsSuccess ? "success" : "error"}`}>
          {message}
        </p>
      )}

      <section className="admin-section" aria-labelledby="category-information-title">
        <div className="section-heading-with-kicker"><span className="section-kicker">Identitas</span><h2 id="category-information-title">Informasi kategori</h2></div>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="category-edit-name">Nama kategori</label>
            <input id="category-edit-name" name="name" autoComplete="off" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)}/>
          </div>
          <div className="field full">
            <label htmlFor="category-edit-description">Deskripsi</label>
            <textarea id="category-edit-description" name="description" maxLength={255} value={description} onChange={event => setDescription(event.target.value)}/>
            <small>{description.length} / 255 karakter</small>
          </div>
        </div>
      </section>

      <section className="admin-section" aria-labelledby="category-products-title">
        <div className="section-inline-head">
          <div>
            <span className="section-kicker">Keanggotaan</span>
            <h2 id="category-products-title">Produk dalam kategori</h2>
            <p>Satu produk hanya dapat berada dalam satu kategori. Produk yang sudah terikat kategori lain tidak dapat dipilih.</p>
          </div>
          <div className="category-products-counts"><span className="count-badge" aria-live="polite">{selected.size} dipilih</span><small>{availableProducts.length} tersedia</small></div>
        </div>

        {products.length > 8 && (
          <div className="category-product-search">
            <Search size={16} aria-hidden="true" />
            <label className="sr-only" htmlFor="category-product-search-input">Cari produk</label>
            <input id="category-product-search-input" name="productSearch" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari produk…" />
          </div>
        )}

        {products.length ? (
          <div className="category-product-list" role="group" aria-labelledby="category-products-title">
            {visibleProducts.map(product => {
              const isSelected = selected.has(product.id);
              const belongsToOtherCategory = Boolean(product.categoryId && product.categoryId !== category.id);
              return (
                <label key={product.id} className={`category-product-option${isSelected ? " selected" : ""}${belongsToOtherCategory ? " is-locked" : ""}`} title={belongsToOtherCategory ? "Produk sudah terikat kategori lain" : undefined}>
                  <input
                    type="checkbox"
                    name={`products.${product.id}`}
                    checked={isSelected}
                    disabled={belongsToOtherCategory}
                    aria-label={`${isSelected ? "Hapus" : "Pilih"} ${product.name}${belongsToOtherCategory ? ", sudah terikat kategori lain" : ""}`}
                    onChange={event => setSelected(current => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(product.id);
                      else next.delete(product.id);
                      return next;
                    })}
                  />
                  <span className="category-product-thumb">
                    {product.imageKey ? <Image unoptimized src={mediaPath(product.imageKey)} alt="" width={48} height={48} /> : <ImageOff size={17} aria-hidden="true" />}
                  </span>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{belongsToOtherCategory ? "Sudah terikat kategori lain" : productStatusLabels[product.status] || product.status}</small>
                  </span>
                </label>
              );
            })}
            {!visibleProducts.length && <p className="empty-hint category-product-filter-empty">Produk tidak ditemukan. Coba kata kunci lain.</p>}
          </div>
        ) : (
          <p className="empty-hint">Belum ada produk yang dapat dimasukkan ke kategori ini.</p>
        )}
      </section>

      <div className="form-footer-actions category-editor-actions">
        <p><Package size={15} aria-hidden="true" /> {selected.size} dari {products.length} produk dipilih.</p>
        <button type="submit" className="button button-dark" disabled={busy}>
          <Save size={15}/> {busy ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}
