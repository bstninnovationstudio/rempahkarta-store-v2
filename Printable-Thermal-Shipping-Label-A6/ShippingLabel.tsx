"use client";

import { useState } from "react";
import Image from "next/image";
import Barcode from "react-barcode";
import styles from "./ShippingLabel.module.css";

export interface ShippingLabelProps {
  data: {
    waybillId: string;
    courierCompany: string;
    courierService: string;
    routingCode?: string;
    codAmount: number;
    isCod: boolean;
    totalQuantity: number;
    totalWeightKg: number;
    sender: {
      name: string;
      phone: string;
      address: string;
      postalCode: string;
    };
    recipient: {
      name: string;
      phone: string;
      address: string;
      postalCode: string;
    };
    itemDescription: string;
    note?: string;
    orderPublicNumber: string;
  };
}

type LogoProps = {
  src: string;
  alt: string;
  fallback: string;
  className?: string;
};

function Logo({ src, alt, fallback, className }: LogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={styles.logoFallback}>{fallback}</span>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={160}
      height={60}
      unoptimized
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function formatWeight(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

export default function ShippingLabel({ data }: ShippingLabelProps) {
  const routingCode = data.routingCode?.trim() || data.recipient.postalCode;
  const codText = data.isCod
    ? formatRupiah(data.codAmount)
    : "Rp 0 (Non-COD)";
  const courierLogo = `/shipping-logos/${slugify(data.courierCompany)}.png`;

  return (
    <section className={styles.printArea} aria-label="Label pengiriman">
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.printButton}
          onClick={() => window.print()}
        >
          Cetak Resi / Simpan PDF
        </button>
      </div>

      <article className={styles.label}>
        <header className={styles.header}>
          <div className={styles.courierLogoBox}>
            <Logo
              src={courierLogo}
              alt={`Logo ${data.courierCompany}`}
              fallback={data.courierCompany.toUpperCase()}
              className={styles.logoImage}
            />
          </div>

          <div className={styles.brandBlock}>
            <div className={styles.brandName}>REMPAHKARTA</div>
            <div className={styles.brandMeta}>
              via Biteship · Order {data.orderPublicNumber}
            </div>
          </div>
        </header>

        <section className={styles.barcodeSection}>
          <div className={styles.barcodeGraphic}>
            <Barcode
              value={data.waybillId}
              format="CODE128"
              renderer="svg"
              width={1.45}
              height={56}
              margin={0}
              displayValue={false}
              background="transparent"
              lineColor="#000000"
            />
          </div>
          <div className={styles.waybillText}>
            Nomor Resi - <strong>{data.waybillId}</strong>
          </div>
        </section>

        <section className={`${styles.centerBox} ${styles.codBox}`}>
          <strong>Nilai COD: {codText}</strong>
        </section>

        <section className={`${styles.centerBox} ${styles.serviceBox}`}>
          <strong>Jenis Layanan - {data.courierService.toUpperCase()}</strong>
        </section>

        <section className={styles.shipmentGrid}>
          <div className={styles.routingBox}>
            <span className={styles.routingLabel}>Routing Code</span>
            <strong className={styles.routingCode}>{routingCode}</strong>
          </div>

          <div className={styles.metricsBox}>
            <div className={styles.metricRow}>
              <span>Quantity</span>
              <span>:</span>
              <strong>{data.totalQuantity} Pcs</strong>
            </div>
            <div className={styles.metricRow}>
              <span>Weight</span>
              <span>:</span>
              <strong>{formatWeight(data.totalWeightKg)} Kg</strong>
            </div>
          </div>
        </section>

        <section className={styles.addressGrid}>
          <address className={styles.addressBox}>
            <strong className={styles.addressTitle}>Alamat Penerima:</strong>
            <strong>{data.recipient.name}</strong>
            <span>{data.recipient.phone}</span>
            <span>{data.recipient.address}</span>
            <span>Kode Pos: {data.recipient.postalCode}</span>
          </address>

          <address className={styles.addressBox}>
            <strong className={styles.addressTitle}>Alamat Pengirim:</strong>
            <strong>{data.sender.name}</strong>
            <span>{data.sender.phone}</span>
            <span>{data.sender.address}</span>
            <span>Kode Pos: {data.sender.postalCode}</span>
          </address>
        </section>

        <section className={styles.infoBox}>
          <strong>Jenis Barang :</strong>
          <span>{data.itemDescription}</span>
        </section>

        <section className={styles.infoBox}>
          <strong>Catatan :</strong>
          <span>{data.note?.trim() || "Tidak Ada"}</span>
        </section>

        <footer className={styles.footer}>
          Pengiriman melalui platform Biteship / REMPAHKARTA
        </footer>
      </article>
    </section>
  );
}
