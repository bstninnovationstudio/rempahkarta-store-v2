"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, Trash2 } from "lucide-react";
import { rupiah } from "@/lib/format";
import Link from "next/link";

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  options: string;
  price: number;
  quantity: number;
}

export function ReturnForm({ number, orderItems }: { number: string; orderItems: OrderItem[] }) {
  const [step, setStep] = useState(1);
  const [problemCode, setProblemCode] = useState("damaged");
  
  // Initialize selectedItems with all items unselected by default
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number }>>(() => {
    const initial: Record<string, { selected: boolean; quantity: number }> = {};
    orderItems.forEach(item => {
      initial[item.id] = { selected: false, quantity: 1 };
    });
    return initial;
  });

  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const problemLabels: Record<string, string> = {
    damaged: "Produk rusak atau cacat",
    wrong: "Produk/varian tidak sesuai",
    incomplete: "Pesanan tidak lengkap/kurang",
  };

  const selectedCount = Object.values(selectedItems).filter(i => i.selected).length;

  const totalRefund = orderItems.reduce((sum, item) => {
    const selection = selectedItems[item.id];
    if (selection?.selected) {
      return sum + item.price * selection.quantity;
    }
    return sum;
  }, 0);

  // Clean up object URLs when files change
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    // Preview URLs are derived from the browser File objects and cleaned up below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    
    // Total files after adding new ones, capped at 5
    const updatedFiles = [...files, ...selectedFiles].slice(0, 5);
    setFiles(updatedFiles);
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function toggleItem(id: string) {
    setSelectedItems(prev => {
      const current = prev[id] || { selected: false, quantity: 1 };
      return {
        ...prev,
        [id]: { ...current, selected: !current.selected }
      };
    });
  }

  function setQuantity(id: string, qty: number) {
    setSelectedItems(prev => ({
      ...prev,
      [id]: { ...prev[id], quantity: qty }
    }));
  }

  async function handleSubmit() {
    setError("");
    setBusy(true);

    const itemsPayload = orderItems
      .filter(item => selectedItems[item.id]?.selected)
      .map(item => ({
        orderItemId: item.id,
        quantity: selectedItems[item.id].quantity
      }));

    if (itemsPayload.length === 0) {
      setError("Pilih minimal satu produk yang bermasalah.");
      setBusy(false);
      return;
    }

    if (description.trim().length < 10) {
      setError("Deskripsi masalah minimal 10 karakter.");
      setBusy(false);
      return;
    }

    if (files.length === 0) {
      setError("Tambahkan minimal 1 foto bukti masalah.");
      setBusy(false);
      return;
    }



    try {
      // 1. Upload media files
      const evidence: string[] = [];
      for (const file of files) {
        const upload = new FormData();
        upload.set("file", file);
        const uploaded = await fetch(`/api/orders/${encodeURIComponent(number)}/media`, { method: "POST", body: upload });
        const result = await uploaded.json();
        if (!uploaded.ok) throw new Error(result.error || "Upload bukti gambar gagal");
        evidence.push(result.path);
      }

      // 2. Submit return request. The current customer flow requests a refund;
      // any physical return instructions are decided after admin review.
      const response = await fetch(`/api/orders/${encodeURIComponent(number)}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "refund",
          cause: problemCode,
          description,
          items: itemsPayload,
          evidence
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pengajuan gagal dikirim");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan mengirim pengajuan");
    } finally {
      setBusy(false);
    }
  }

  function handleNext() {
    setError("");
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (selectedCount === 0) {
        setError("Pilih minimal satu produk yang bermasalah.");
        return;
      }
      if (description.trim().length < 10) {
        setError("Harap isi deskripsi masalah minimal 10 karakter.");
        return;
      }
      if (files.length === 0) {
        setError("Harap unggah minimal 1 foto bukti masalah.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  }

  if (success) return (
    <section className="panel return-success">
      <CheckCircle2 size={40} aria-hidden="true" />
      <h2>Pengajuan sudah diterima</h2>
      <p>Tim toko kami akan meninjau bukti Anda maksimal 1 hari kerja. Hasil dan pilihan pengiriman retur akan tampil di halaman pesanan.</p>
      <Link href={`/orders/${number}`} className="button button-dark">Kembali ke detail pesanan</Link>
    </section>
  );

  return (
    <section className="panel return-wizard">
      <div className="tracking-progress return-progress" aria-label={`Langkah ${step} dari 4`}>
        <div className={`tracking-step ${step >= 1 ? "done" : ""}`}>Pilih masalah</div>
        <div className={`tracking-step ${step >= 2 ? "done" : ""}`}>Produk & bukti</div>
        <div className={`tracking-step ${step >= 3 ? "done" : ""}`}>Resolusi</div>
        <div className={`tracking-step ${step >= 4 ? "done" : ""}`}>Konfirmasi</div>
      </div>

      {step === 1 && (
        <div className="return-step">
          <h2>Apa masalah pada pesanan ini?</h2>
          <div className="return-options">
            {Object.entries(problemLabels).map(([value, label]) => (
              <label key={value} className={`shipping-option return-choice ${problemCode === value ? "active" : ""}`}>
                <span>
                  <strong>{label}</strong>
                  <span>Pilih masalah untuk memproses pengajuan.</span>
                </span>
                <input type="radio" name="problem" value={value} checked={problemCode === value} onChange={() => setProblemCode(value)} />
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="return-step">
          <h2>Produk yang bermasalah</h2>
          <p className="return-step-intro">Centang produk bermasalah dan tentukan jumlah produk yang rusak, kurang, atau salah kirim.</p>

          <div className="return-item-list">
            {orderItems.map(item => {
              const selection = selectedItems[item.id] || { selected: false, quantity: 1 };
              return (
                <div key={item.id} className={`return-item ${selection.selected ? "selected" : ""}`}>
                  <input type="checkbox" checked={selection.selected} onChange={() => toggleItem(item.id)} aria-label={`Pilih ${item.name}`} />
                  <div className="return-item-copy">
                    <span>{item.sku}</span>
                    <h3>{item.name}</h3>
                    <p>{item.options}</p>
                    <strong>{rupiah(item.price)}</strong>
                  </div>
                  {selection.selected && (
                    <label className="return-quantity">
                      <span>Jumlah</span>
                      <select value={selection.quantity} onChange={e => setQuantity(item.id, Number(e.target.value))}>
                        {Array.from({ length: item.quantity }, (_, index) => index + 1).map(quantity => (
                          <option key={quantity} value={quantity}>{quantity}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="field return-description">
            <label htmlFor="description">Ceritakan masalahnya</label>
            <textarea id="description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Contoh: Barang pecah di sudut bawah saat diterima, atau varian yang dikirim tidak sesuai pesanan..." />
          </div>

          <div className="return-evidence-field">
            <strong>Unggah gambar bukti</strong>
            <p>Unggah 1 s.d. 5 foto bukti produk yang bermasalah. Foto label resi atau kemasan sangat dianjurkan.</p>
            <div className="return-evidence-grid">
              {previews.map((src, index) => (
                <div className="return-evidence" key={src}>
                  <Image src={src} alt={`Bukti masalah ${index + 1}`} width={320} height={320} unoptimized />
                  <button type="button" onClick={() => removeFile(index)} aria-label={`Hapus bukti ${index + 1}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {files.length < 5 && (
                <label className="return-upload">
                  <Camera size={19} aria-hidden="true" />
                  <span>Pilih foto</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} />
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="return-step">
          <h2>Pilih solusi resolusi</h2>
          <label className="shipping-option return-choice active">
            <span>
              <strong>Pengembalian dana (refund)</strong>
              <span>Dana dikembalikan senilai produk bermasalah tanpa retur barang.</span>
            </span>
            <input type="radio" name="solution" value="refund" checked readOnly />
          </label>
          <div className="return-total">
            <span>Total estimasi pengembalian dana</span>
            <strong>{rupiah(totalRefund)}</strong>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="return-step return-review">
          <h2>Draf ringkasan pengajuan</h2>
          <div className="detail-list">
            <div><span>Jenis masalah</span><strong>{problemLabels[problemCode]}</strong></div>
            <div><span>Solusi diminta</span><strong className="text-accent">Pengembalian dana saja</strong></div>
            <div><span>Deskripsi masalah</span><strong className="detail-copy">{description}</strong></div>
            <div>
              <span>Estimasi refund</span>
              <strong className="text-success">{rupiah(totalRefund)}</strong>
            </div>
          </div>

          <div className="return-review-section">
            <p className="return-review-label">Produk yang diajukan</p>
            <div className="return-review-items">
              {orderItems.filter(item => selectedItems[item.id]?.selected).map(item => (
                <div className="return-review-item" key={item.id}>
                  <div><strong>{item.name}</strong><span>{item.options} · {selectedItems[item.id].quantity} item</span></div>
                  <strong>{rupiah(item.price * selectedItems[item.id].quantity)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="return-review-section">
            <p className="return-review-label">Bukti gambar ({files.length})</p>
            <div className="return-review-evidence">
              {previews.map((src, index) => (
                <Image key={src} src={src} alt={`Bukti masalah ${index + 1}`} width={64} height={64} unoptimized />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="form-alert">{error}</p>}

      <div className="wizard-actions">
        {step > 1 ? (
          <button type="button" className="button button-light" onClick={() => setStep(step - 1)} disabled={busy}>Kembali</button>
        ) : <span />}
        <button type="button" className="button button-dark" onClick={step === 4 ? handleSubmit : handleNext} disabled={busy}>
          {busy ? "Mengirim…" : step === 4 ? "Kirim pengajuan" : "Lanjutkan"}
        </button>
      </div>
    </section>
  );
}
