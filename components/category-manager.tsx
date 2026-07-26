"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, Settings2, Trash2, X } from "lucide-react";
import { CatalogOrderControls } from "@/components/catalog-order-controls";

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
  const [createOpen, setCreateOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!createOpen) return;
    nameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setCreateOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createOpen, busy]);

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
      <div className="admin-page-head category-page-head">
        <div>
          <Link href="/admin/products" className="eyebrow admin-back"><ChevronLeft size={13} aria-hidden="true" /> Kembali ke produk</Link>
          <h1>Kategori</h1>
          <p>Tambah, edit, hapus, dan atur keanggotaan produk pada setiap kategori.</p>
        </div>
        <button type="button" className="button button-dark" onClick={() => { setMessage(""); setCreateOpen(true); }} disabled={Boolean(busy)}>
          <Plus size={15} aria-hidden="true" /> Tambah kategori
        </button>
      </div>
      {message && !createOpen && <p className="form-banner error category-manager-message" role="alert">{message}</p>}
      <section className="table-card category-list-card" aria-label="Daftar kategori">
          <div className="admin-table-wrap" role="region" aria-labelledby="category-list-title" tabIndex={0}>
            <table className="admin-table category-table">
              <caption id="category-list-title" className="table-caption">Kategori produk beserta jumlah produk dan aksi pengelolaannya.</caption>
              <thead>
                <tr>
                  <th scope="col">Urutan</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Produk</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((item, index) => (
                  <tr key={item.id}>
                    <td><CatalogOrderControls endpoint={`/api/admin/categories/${item.id}/position`} label={item.name} isFirst={index === 0} isLast={index === categories.length - 1}/></td>
                    <td className="category-table-copy">
                      <strong>{item.name}</strong>
                      <span className="sub">{item.description || "Tanpa deskripsi"}</span>
                    </td>
                    <td>{item.productCount}</td>
                    <td>
                      <div className="table-actions">
                        <Link href={`/admin/categories/${item.id}`} className="icon-button" aria-label={`Kelola kategori ${item.name}`} title={`Kelola ${item.name}`}>
                          <Settings2 size={15} aria-hidden="true" />
                        </Link>
                        <button type="button" className="icon-button danger" disabled={Boolean(busy)} onClick={() => remove(item)} aria-label={busy === item.id ? `Menghapus kategori ${item.name}` : `Hapus kategori ${item.name}`} title={`Hapus ${item.name}`}>
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!categories.length && <tr><td className="table-empty-state" colSpan={4}>Belum ada kategori. Gunakan formulir tambah kategori untuk memulai.</td></tr>}
              </tbody>
            </table>
          </div>
      </section>

      {createOpen && (
        <div className="category-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setCreateOpen(false); }}>
          <div className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-create-title">
            <div className="category-modal-head">
              <div><span className="section-kicker">Katalog</span><h2 id="category-create-title">Tambah kategori</h2><p>Gunakan nama ringkas agar kategori mudah dipindai di katalog.</p></div>
              <button type="button" className="icon-button" onClick={() => setCreateOpen(false)} disabled={Boolean(busy)} aria-label="Tutup dialog tambah kategori" title="Tutup"><X size={18} aria-hidden="true" /></button>
            </div>
            <form className="category-create-form" onSubmit={create}>
              {message && <p className="form-banner error category-manager-message" role="alert">{message}</p>}
              <div className="field-grid">
                <div className="field full">
                  <label htmlFor="category-create-name">Nama kategori</label>
                  <input ref={nameRef} id="category-create-name" name="name" autoComplete="off" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Rempah Utuh" />
                </div>
                <div className="field full">
                  <label htmlFor="category-create-description">Deskripsi singkat</label>
                  <textarea id="category-create-description" name="description" maxLength={255} value={description} onChange={event => setDescription(event.target.value)} placeholder="Opsional…" />
                  <small>{description.length} / 255 karakter</small>
                </div>
              </div>
              <div className="category-modal-actions">
                <button type="button" className="button button-light" onClick={() => setCreateOpen(false)} disabled={Boolean(busy)}>Batal</button>
                <button type="submit" className="button button-dark" disabled={Boolean(busy)}><Plus size={15} aria-hidden="true" /> {busy === "create" ? "Menyimpan…" : "Simpan kategori"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
