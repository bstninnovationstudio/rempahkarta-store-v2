"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Category = { id: string; name: string; description: string | null; productCount: number };

async function responseJson(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Respons server tidak valid");
  }
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setMessage("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error || "Kategori gagal dibuat"));
      location.reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Kategori gagal dibuat");
      setBusy("");
    }
  }

  async function remove(category: Category) {
    if (!confirm(`Hapus kategori ${category.name}? Produk di dalamnya akan menjadi tanpa kategori.`)) return;
    setBusy(category.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error || "Kategori gagal dihapus"));
      location.reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Kategori gagal dihapus");
      setBusy("");
    }
  }

  return (
    <div className="category-manager" aria-busy={Boolean(busy)}>
      {message && <p className="form-banner error category-manager-message" role="alert">{message}</p>}
      <div className="category-admin-grid">
        <form className="admin-section category-create-form" onSubmit={create}>
          <h2>Tambah kategori</h2>
          <p className="section-description">Gunakan nama yang ringkas agar kategori mudah dipindai di katalog dan panel admin.</p>
          <div className="field-grid">
            <div className="field full">
              <label htmlFor="category-create-name">Nama kategori</label>
              <input id="category-create-name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Rempah Utuh"/>
            </div>
            <div className="field full">
              <label htmlFor="category-create-description">Deskripsi singkat</label>
              <textarea id="category-create-description" maxLength={255} value={description} onChange={event => setDescription(event.target.value)} placeholder="Opsional"/>
              <small>{description.length} / 255 karakter</small>
            </div>
          </div>
          <button type="submit" className="button button-dark" disabled={Boolean(busy)}>
            <Plus size={15}/> {busy === "create" ? "Menyimpan…" : "Tambah kategori"}
          </button>
        </form>

        <section className="table-card category-list-card" aria-labelledby="category-list-title">
          <div className="admin-panel-head">
            <div>
              <h2 id="category-list-title">Daftar kategori</h2>
              <p>{categories.length} kategori tersimpan</p>
            </div>
          </div>
          <div className="admin-table-wrap" role="region" aria-labelledby="category-list-title" tabIndex={0}>
            <table className="admin-table category-table">
              <caption className="table-caption">Kategori produk beserta jumlah produk dan aksi pengelolaannya.</caption>
              <thead>
                <tr>
                  <th scope="col">Kategori</th>
                  <th scope="col">Produk</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(item => (
                  <tr key={item.id}>
                    <td className="category-table-copy">
                      <strong>{item.name}</strong>
                      <span className="sub">{item.description || "Tanpa deskripsi"}</span>
                    </td>
                    <td>{item.productCount}</td>
                    <td>
                      <div className="table-actions">
                        <Link href={`/admin/categories/${item.id}`} className="button button-light button-compact" aria-label={`Kelola kategori ${item.name}`}>Kelola</Link>
                        <button type="button" className="icon-button danger" disabled={Boolean(busy)} onClick={() => remove(item)} aria-label={busy === item.id ? `Menghapus kategori ${item.name}` : `Hapus kategori ${item.name}`} title={`Hapus ${item.name}`}>
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!categories.length && <tr><td className="table-empty-state" colSpan={3}>Belum ada kategori. Gunakan formulir tambah kategori untuk memulai.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
