"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type Product = { id: string; name: string; status: string; selected: boolean };

export function CategoryEditor({ category, products }: { category: { id: string; name: string; description: string | null }; products: Product[] }) {
  const [name, setName] = useState(category.name); const [description, setDescription] = useState(category.description || "");
  const [selected, setSelected] = useState(() => new Set(products.filter(item => item.selected).map(item => item.id)));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: description || null, productIds: [...selected] }) });
      const text = await response.text(); const result = text ? JSON.parse(text) as Record<string, unknown> : {};
      if (!response.ok) throw new Error(String(result.error || "Kategori gagal disimpan")); setMessage("Kategori dan keanggotaan produk berhasil disimpan.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Kategori gagal disimpan"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}><section className="admin-section"><div className="field-grid"><div className="field"><label>Nama kategori</label><input required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)}/></div><div className="field full"><label>Deskripsi</label><textarea maxLength={255} value={description} onChange={event => setDescription(event.target.value)}/></div></div></section><section className="admin-section"><h2>Produk dalam kategori</h2><p className="empty-hint">Satu produk hanya dapat berada dalam satu kategori. Memilih produk di sini akan memindahkannya dari kategori sebelumnya.</p><div className="category-product-list">{products.map(product => <label key={product.id}><input type="checkbox" checked={selected.has(product.id)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(product.id); else next.delete(product.id); return next; })}/><span><strong>{product.name}</strong><small>{product.status}</small></span></label>)}</div></section><div className="form-footer-actions"><button className="button button-dark" disabled={busy}><Save size={15}/> {busy ? "Menyimpan…" : "Simpan perubahan"}</button>{message && <p role="status" className={message.includes("berhasil") ? "form-success" : "form-error"}>{message}</p>}</div></form>;
}
