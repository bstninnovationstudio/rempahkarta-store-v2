"use client";

import Link from "next/link";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

async function responseJson(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error("Respons server tidak valid"); }
}

export function ProductTableActions({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    const confirmed = window.confirm(`Hapus produk “${name}”? Produk yang memiliki riwayat transaksi, stok, atau data keranjang akan diarsipkan agar audit tetap terjaga.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Produk gagal dihapus");
      window.location.reload();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Produk gagal dihapus");
      setBusy(false);
    }
  }

  return (
    <div className="table-actions product-table-actions">
      <Link href={`/admin/products/${id}`} className="icon-button" aria-label={`Edit produk ${name}`} title="Edit">
        <Pencil size={15} aria-hidden="true" />
      </Link>
      <Link href={`/admin/products/new?duplicate=${encodeURIComponent(id)}`} className="icon-button" aria-label={`Duplikat produk ${name}`} title="Duplikat">
        <Copy size={15} aria-hidden="true" />
      </Link>
      <button type="button" className="icon-button danger" onClick={remove} disabled={busy} aria-label={busy ? `Menghapus produk ${name}` : `Hapus produk ${name}`} title="Hapus">
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
