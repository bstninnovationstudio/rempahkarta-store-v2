"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { LockKeyhole, Search, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { rupiah } from "@/lib/format";
import type { Product, StoreVariant } from "@/lib/types";
import { useTurnstile } from "@/components/use-turnstile";
import { calculateServiceFee } from "@/lib/fee";

type ShippingOption = { id: string; company: string; type: string; name: string; eta: string; price: number };
type Area = { id: string; label: string; postalCode: string };

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) throw new Error(`Server tidak mengembalikan data (${response.status}). Periksa log aplikasi.`);
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error(`Respons server tidak valid (${response.status}).`); }
}

export function CheckoutForm({
  product,
  variant,
  allProducts = [],
  fromCart = false,
  turnstileSiteKey,
  savedAddresses = [],
  customerEmail = "",
  customerName = "",
}: {
  product: Product | null;
  variant: StoreVariant | null;
  allProducts?: Product[];
  fromCart?: boolean;
  turnstileSiteKey: string;
  savedAddresses?: Array<{ id: string; label: string; contactName: string; contactPhone: string; contactEmail: string; address: string; postalCode: string; areaId: string }>;
  customerEmail?: string;
  customerName?: string;
}) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [shipping, setShipping] = useState<ShippingOption | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaResults, setAreaResults] = useState<Array<{ id: string; name: string; postal_code: number }>>([]);
  const [searchingArea, setSearchingArea] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [cartItems, setCartItems] = useState<Array<{ productId: string; variantId: string; quantity: number; product: Product; variant: StoreVariant }>>([]);

  const [nameInput, setNameInput] = useState(customerName);
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState(customerEmail);
  const [addressInput, setAddressInput] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("custom");
  
  const { containerRef, token: turnstileToken } = useTurnstile(turnstileSiteKey);

  useEffect(() => {
    if (fromCart) {
      try {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const resolved = cart.map((item: { productId: string; variantId: string; quantity: number }) => {
          const prod = allProducts.find(p => p.id === item.productId);
          const v = prod?.variants.find(x => x.id === item.variantId);
          if (prod && v) {
            return { ...item, product: prod, variant: v };
          }
          return null;
        }).filter((item: unknown): item is { productId: string; variantId: string; quantity: number; product: Product; variant: StoreVariant } => item !== null);
        
        Promise.resolve().then(() => {
          setCartItems(resolved);
        });
      } catch {
        Promise.resolve().then(() => {
          setCartItems([]);
        });
      }
    }
  }, [fromCart, allProducts]);

  const subtotal = fromCart
    ? cartItems.reduce((sum, item) => sum + item.variant.price * item.quantity, 0)
    : (variant ? variant.price : 0);
  const baseAmount = subtotal + (shipping?.price ?? 0);
  const feeBreakdown = calculateServiceFee(baseAmount);
  const serviceFee = shipping ? feeBreakdown.serviceFee : 0;
  const total = shipping ? feeBreakdown.grandTotal : subtotal;
  const variantLabel = variant ? ([variant.option1Value, variant.option2Value].filter(Boolean).join(" · ") || "Produk tunggal") : "";
  const totalWeight = fromCart
    ? cartItems.reduce((sum, item) => sum + (item.variant.weight || 0) * item.quantity, 0)
    : (variant ? (variant.weight || 0) : 0);
  const formattedWeight = totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} kg` : `${totalWeight} g`;

  async function searchArea() {
    if (areaQuery.trim().length < 3) return setError("Masukkan minimal 3 karakter kecamatan atau kode pos.");
    setSearchingArea(true); setError(""); setAreaResults([]); setArea(null); setOptions([]); setShipping(null);
    try {
      const token = await turnstileToken("location_search");
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(areaQuery.trim())}`, { headers: { "X-Turnstile-Token": token } });
      const data = await readJson(response);
      if (!response.ok) throw new Error(String(data.error || "Pencarian lokasi gagal"));
      const results = ((data.areas || (data.data as { areas?: unknown[] } | undefined)?.areas || []) as Array<{ id: string; name: string; postal_code: number }>).slice(0, 10);
      setAreaResults(results);
      if (!results.length) setError("Lokasi tidak ditemukan. Coba nama kecamatan atau kode pos lain.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pencarian lokasi gagal"); }
    finally { setSearchingArea(false); }
  }

  async function loadRates(targetArea?: Area | null) {
    const activeArea = targetArea !== undefined ? targetArea : area;
    if (!activeArea) return setError("Pilih lokasi hasil pencarian terlebih dahulu.");
    setLoadingRates(true); setError(""); setOptions([]); setShipping(null);
    try {
      const token = await turnstileToken("shipping_quotes");
      const itemsPayload = fromCart
        ? cartItems.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
          }))
        : (product && variant ? [{
            variantId: variant.id,
            quantity: 1,
          }] : []);

      const response = await fetch("/api/checkout/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken: token,
          destinationAreaId: activeArea.id,
          destinationPostalCode: Number(activeArea.postalCode),
          items: itemsPayload
        })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(String(data.error || "Tarif pengiriman gagal dimuat"));
      const pricing = (data.pricing || (data.data as { pricing?: unknown[] } | undefined)?.pricing || []) as Array<{ company: string; courier_type: string; courier_name: string; courier_service_name: string; price: number; shipment_duration_range: string; shipment_duration_unit: string }>;
      const mapped = pricing.map(rate => ({ id: `${rate.company}-${rate.courier_type}`, company: rate.company, type: rate.courier_type, name: `${rate.courier_name} ${rate.courier_service_name}`.trim(), eta: `${rate.shipment_duration_range} ${rate.shipment_duration_unit}`, price: rate.price }));
      setOptions(mapped); if (mapped.length === 1) setShipping(mapped[0]);
      if (!mapped.length) setError("Tidak ada layanan pengiriman yang tersedia untuk alamat ini.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tarif pengiriman gagal dimuat"); }
    finally { setLoadingRates(false); }
  }

  function handleAddressSelect(addressId: string) {
    if (selectedAddressId === addressId) {
      // Toggle off to custom if clicking the active one
      setSelectedAddressId("custom");
      setNameInput(customerName);
      setPhoneInput("");
      setEmailInput(customerEmail);
      setAddressInput("");
      setArea(null);
      setAreaQuery("");
      setOptions([]);
      setShipping(null);
    } else {
      setSelectedAddressId(addressId);
      if (addressId === "custom") {
        setNameInput(customerName);
        setPhoneInput("");
        setEmailInput(customerEmail);
        setAddressInput("");
        setArea(null);
        setAreaQuery("");
        setOptions([]);
        setShipping(null);
      } else {
        const addr = savedAddresses.find(a => a.id === addressId);
        if (addr) {
          setNameInput(addr.contactName);
          setPhoneInput(addr.contactPhone);
          setEmailInput(addr.contactEmail);
          setAddressInput(addr.address);
          const activeArea = { id: addr.areaId, label: `Kode Pos ${addr.postalCode}`, postalCode: addr.postalCode };
          setArea(activeArea);
          setAreaQuery(activeArea.label);
          loadRates(activeArea);
        }
      }
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) return setError("Anda harus menyetujui kebijakan pengiriman serta retur/refund.");
    if (!area || !shipping) return setError("Pilih alamat hasil pencarian dan layanan pengiriman terlebih dahulu.");
    setBusy(true); setError("");
    try {
      const token = await turnstileToken("checkout_order");
      const itemsPayload = fromCart
        ? cartItems.map(item => ({ variantId: item.variantId, quantity: item.quantity }))
        : (variant ? [{ variantId: variant.id, quantity: 1 }] : []);

      const response = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken: token,
          name: nameInput,
          email: emailInput,
          phone: phoneInput,
          address: addressInput,
          postalCode: area.postalCode,
          areaId: area.id,
          shipping: { company: shipping.company, type: shipping.type, name: shipping.name, price: shipping.price, eta: shipping.eta },
          items: itemsPayload,
          acceptPolicies: true
        })
      });
      const data = await readJson(response);
      if (!response.ok) {
        if (data.code === "SHIPPING_PRICE_CHANGED" && data.shipping) {
          const changedData = data.shipping as Omit<ShippingOption, "id">;
          const changed = { id: `${changedData.company}-${changedData.type}`, ...changedData };
          setOptions(current => current.map(option => option.company === changed.company && option.type === changed.type ? changed : option)); setShipping(changed);
        }
        throw new Error(String(data.error || "Checkout gagal. Silakan ulangi."));
      }

      if (fromCart) {
        localStorage.removeItem("cart");
        window.dispatchEvent(new Event("cart-updated"));
      }

      if (typeof data.payment_page_url !== "string") throw new Error("URL pembayaran tidak tersedia");
      window.location.href = data.payment_page_url;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Checkout gagal. Silakan ulangi."); setBusy(false); }
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <form className="checkout-layout" onSubmit={submit}>
        <div>
          <section className="form-section">
            <div className="form-section-head">
              <span className="step-number">A</span>
              <h2>Alamat tersimpan</h2>
            </div>
            <div className="address-cards-grid">
              {savedAddresses.map(addr => (
                <button
                  type="button"
                  key={addr.id}
                  className={`address-card ${selectedAddressId === addr.id ? "active" : ""}`}
                  onClick={() => handleAddressSelect(addr.id)}
                >
                  <div className="address-card-label">{addr.label}</div>
                  <div className="address-card-name">{addr.contactName}</div>
                  <div className="address-card-phone">{addr.contactPhone}</div>
                  <div className="address-card-detail">{addr.address}</div>
                  <div className="address-card-postal">Kode Pos: {addr.postalCode}</div>
                </button>
              ))}
              
              <button
                type="button"
                className={`address-card ${selectedAddressId === "custom" ? "active" : ""}`}
                onClick={() => handleAddressSelect("custom")}
              >
                <div className="address-card-label">Alamat Kustom</div>
                <div className="address-card-name">Gunakan alamat kustom baru</div>
                <div className="address-card-detail">Masukkan nama, kontak, dan alamat pengiriman baru di bawah ini.</div>
              </button>
            </div>

            {savedAddresses.length < 5 ? (
              <div className="saved-address-note">
                <Link href="/user/addresses?action=new&redirect=/checkout">
                  + Simpan alamat baru di pengaturan (slot {savedAddresses.length}/5)
                </Link>
              </div>
            ) : (
              <div className="saved-address-note muted">
                Limit alamat tersimpan (5/5) penuh. Kelola di <Link href="/user/addresses">pengaturan alamat</Link>.
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="step-number">B</span>
              <h2>Detail Pengiriman</h2>
            </div>
            
            <div className="form-sub-section">
              <h3 className="form-sub-title">Kontak Penerima</h3>
              <div className="field-grid mb-6">
                <div className="field">
                  <label htmlFor="name">Nama lengkap</label>
                  <input id="name" name="name" required minLength={2} maxLength={160} autoComplete="name" placeholder="Budi Santoso" value={nameInput} onChange={e => setNameInput(e.target.value)} disabled={selectedAddressId !== "custom"} />
                </div>
                <div className="field">
                  <label htmlFor="phone">Nomor WhatsApp</label>
                  <input id="phone" name="phone" required minLength={8} maxLength={20} inputMode="tel" autoComplete="tel" pattern="[0-9+() -]{8,20}" placeholder="0812 3456 7890" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} disabled={selectedAddressId !== "custom"} />
                </div>
                <div className="field full">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="budi@email.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} disabled={selectedAddressId !== "custom"} />
                  <small>Email dipakai untuk konfirmasi dan melacak pesanan.</small>
                </div>
              </div>
            </div>

            <div className="form-sub-section">
              <h3 className="form-sub-title">Alamat Pengiriman</h3>
              <div className="field-grid">
                <div className="field full">
                  <label htmlFor="area">Kecamatan atau kode pos</label>
                  <div className="search-field">
                    <input id="area" required minLength={3} maxLength={120} value={areaQuery} onChange={event => { setAreaQuery(event.target.value); setArea(null); setAreaResults([]); setOptions([]); setShipping(null); }} autoComplete="off" placeholder="Tulis kecamatan atau kode pos" disabled={selectedAddressId !== "custom"} />
                    <button className="button button-light" type="button" disabled={searchingArea || selectedAddressId !== "custom"} onClick={searchArea}>
                      <Search size={15} /> {searchingArea ? "Mencari…" : "Cari"}
                    </button>
                  </div>
                  {areaResults.length > 0 && (
                    <div className="area-results static">
                      {areaResults.map(result => (
                        <button type="button" key={result.id} onClick={() => { const selected = { id: result.id, label: `${result.name} — ${result.postal_code}`, postalCode: String(result.postal_code) }; setArea(selected); setAreaQuery(selected.label); setAreaResults([]); setOptions([]); setShipping(null); }}>
                          {result.name} · {result.postal_code}
                        </button>
                      ))}
                    </div>
                  )}
                  {area && <small className="selected-hint">Lokasi terpilih: {area.label}</small>}
                </div>
                <div className="field full">
                  <label htmlFor="address">Alamat lengkap</label>
                  <textarea id="address" name="address" required minLength={10} maxLength={1000} autoComplete="street-address" placeholder="Nama jalan, nomor rumah, RT/RW, patokan" value={addressInput} onChange={e => setAddressInput(e.target.value)} disabled={selectedAddressId !== "custom"} />
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="step-number">C</span>
              <h2>Pilih Jasa Pengiriman</h2>
            </div>
            {!area ? (
              <div className="shipping-placeholder">Pilih kecamatan atau kode pos yang valid terlebih dahulu.</div>
            ) : (
              <>
                {selectedAddressId === "custom" ? (
                  <button type="button" className="button button-light button-block" disabled={loadingRates} onClick={() => loadRates()}>
                    {loadingRates ? "Menghitung ongkir…" : options.length ? "Perbarui ongkir" : "Cek ongkir"}
                  </button>
                ) : (
                  loadingRates && (
                    <div className="shipping-loading">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Menghitung ongkir…</span>
                    </div>
                  )
                )}
                <div className="shipping-options-list">
                  {options.map(option => (
                    <button type="button" key={option.id} className={`shipping-option ${shipping?.id === option.id ? "active" : ""}`} onClick={() => setShipping(option)}>
                      <div>
                        <strong>{option.name}</strong>
                        <span>Estimasi tiba {option.eta}</span>
                      </div>
                      <strong>{rupiah(option.price)}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="order-summary">
          <h2>Ringkasan pesanan</h2>
          {fromCart ? (
            cartItems.map(item => {
              const itemLabel = [item.variant.option1Value, item.variant.option2Value].filter(Boolean).join(" · ") || "Produk tunggal";
              return (
                <div key={item.variantId} className="summary-product checkout-summary-product">
                  <div className="summary-product-image">
                    <Image unoptimized src={item.product.image} alt={item.product.name} fill />
                  </div>
                  <div>
                    <h3>{item.product.name}</h3>
                    <p>{itemLabel} · {item.quantity} item</p>
                    <strong>{rupiah(item.variant.price * item.quantity)}</strong>
                  </div>
                </div>
              );
            })
          ) : (
            product && variant && (
              <div className="summary-product">
                <div className="summary-product-image">
                  <Image unoptimized src={product.image} alt={product.name} fill />
                </div>
                <div>
                  <h3>{product.name}</h3>
                  <p>{variantLabel} · 1 item</p>
                  <strong>{rupiah(variant.price)}</strong>
                </div>
              </div>
            )
          )}

          <div className="summary-lines">
            <div className="summary-line">
              <span>Subtotal</span>
              <span>{rupiah(subtotal)}</span>
            </div>
            <div className="summary-line">
              <span>Total Berat</span>
              <span>{formattedWeight}</span>
            </div>
            <div className="summary-line">
              <span>Pengiriman</span>
              <span>{shipping ? rupiah(shipping.price) : "Belum dipilih"}</span>
            </div>
            <div className="summary-line">
              <span>Biaya Layanan</span>
              <span>{shipping ? rupiah(serviceFee) : "Hitung ongkir dahulu"}</span>
            </div>
            <div className="summary-line total">
              <span>Total invoice</span>
              <span>{rupiah(total)}</span>
            </div>
          </div>

          <label className="policy-check">
            <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
            <span>Saya menyetujui <Link href="/pages/shipping">kebijakan pengiriman</Link> dan <Link href="/pages/returns">retur/refund</Link>.</span>
          </label>

          {error && <p role="alert" className="checkout-error">{error}</p>}

          <button
            className="button button-dark button-block"
            disabled={busy || !accepted || !area || !shipping || (fromCart ? cartItems.length === 0 : !variant || variant.stock <= 0)}
          >
            {busy ? "Membuat QRIS…" : "Bayar dengan QRIS"}
          </button>

          <p className="summary-note secure-checkout-note">
            <LockKeyhole size={15} /> Pembayaran Terlindungi
          </p>
          <div ref={containerRef} className="turnstile-container" aria-live="polite" />
        </aside>
      </form>
    </>
  );
}
