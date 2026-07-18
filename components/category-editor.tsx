"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type Product = { id: string; name: string; status: string; selected: boolean };

const productStatusLabels: Record<string, string> = {
  active: "Aktif",
  draft: "Draft",
  archived: "Diarsipkan",
};

export function CategoryEditor({ category, products }: { category: { id: string; name: string; description: string | null }; products: Product[] }) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || "");
  const [selected, setSelected] = useState(() => new Set(products.filter(item => item.selected).map(item => item.id)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const messageIsSuccess = message.includes("berhasil");

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
      const result = text ? JSON.parse(text) as Record<string, unknown> : {};
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
        <h2 id="category-information-title">Informasi kategori</h2>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="category-edit-name">Nama kategori</label>
            <input id="category-edit-name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)}/>
          </div>
          <div className="field full">
            <label htmlFor="category-edit-description">Deskripsi</label>
            <textarea id="category-edit-description" maxLength={255} value={description} onChange={event => setDescription(event.target.value)}/>
            <small>{description.length} / 255 karakter</small>
          </div>
        </div>
      </section>

      <section className="admin-section" aria-labelledby="category-products-title">
        <div className="section-inline-head">
          <div>
            <h2 id="category-products-title">Produk dalam kategori</h2>
            <p>Satu produk hanya dapat berada dalam satu kategori. Memilih produk di sini akan memindahkannya dari kategori sebelumnya.</p>
          </div>
          <span className="count-badge" aria-live="polite">{selected.size} dipilih</span>
        </div>

        {products.length ? (
          <div className="category-product-list" role="group" aria-labelledby="category-products-title">
            {products.map(product => {
              const isSelected = selected.has(product.id);
              return (
                <label key={product.id} className={`category-product-option${isSelected ? " selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={event => setSelected(current => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(product.id);
                      else next.delete(product.id);
                      return next;
                    })}
                  />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{productStatusLabels[product.status] || product.status}</small>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="empty-hint">Belum ada produk yang dapat dimasukkan ke kategori ini.</p>
        )}
      </section>

      <div className="form-footer-actions category-editor-actions">
        <p>{selected.size} dari {products.length} produk dipilih.</p>
        <button type="submit" className="button button-dark" disabled={busy}>
          <Save size={15}/> {busy ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}
