import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { checkAndExpireOrder } from "@/lib/payment-sync";

import PrintInvoiceButton from "./PrintInvoiceButton";
import styles from "./invoice.module.css";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ print?: string | string[] }>;
};

type UnknownRecord = Record<string, unknown>;

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Lunas",
  pending: "Menunggu Pembayaran",
  unpaid: "Belum Dibayar",
  failed: "Pembayaran Gagal",
  expired: "Pembayaran Kedaluwarsa",
  refunded: "Dana Dikembalikan",
  partially_refunded: "Dana Dikembalikan Sebagian",
  cancelled: "Dibatalkan",
};

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : {};
}

function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function firstValue(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function firstText(
  record: UnknownRecord,
  keys: string[],
  fallback = "-",
): string {
  const value = firstValue(record, keys);
  return value === undefined ? fallback : String(value);
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  try {
    return BigInt(String(value ?? 0));
  } catch {
    return BigInt(0);
  }
}

function toPositiveInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatRupiah(value: unknown): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toBigInt(value));
}

function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";

  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return `${formatted} WIB`;
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function paymentLabel(value: unknown): string {
  const state = String(value ?? "pending").toLowerCase();
  return PAYMENT_LABELS[state] ?? titleCase(state);
}

function optionsLabel(value: unknown): string {
  if (!value) return "";

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((option) => {
        const item = asRecord(option);
        const name = firstText(item, ["name", "label", "key"], "");
        const optionValue = firstText(item, ["value", "option", "label"], "");
        return name && optionValue
          ? `${name}: ${optionValue}`
          : optionValue || name;
      })
      .filter(Boolean)
      .join(", ");
  }

  const object = asRecord(parsed);
  return Object.entries(object)
    .map(([key, optionValue]) => `${key}: ${String(optionValue)}`)
    .join(", ");
}

function completeAddress(address: UnknownRecord): string {
  const explicitAddress = firstText(
    address,
    ["fullAddress", "address", "addressLine", "street"],
    "",
  );
  const area = [
    firstText(address, ["village", "subdistrict", "district"], ""),
    firstText(address, ["city", "regency"], ""),
    firstText(address, ["province"], ""),
  ].filter(Boolean);

  return [explicitAddress, ...area].filter(Boolean).join(", ") || "-";
}

function joinLabel(...parts: string[]): string {
  return parts.filter((part) => part && part !== "-").join(" ") || "-";
}

export default async function InvoicePage({ params, searchParams }: PageProps) {
  const { number: rawNumber } = await params;
  // Next.js sudah mendekode dynamic route segment pada `params`.
  const number = rawNumber;
  const customer = await customerFromRequest();

  if (!customer) {
    const returnPath = `/orders/${encodeURIComponent(number)}/invoice`;
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  await checkAndExpireOrder(number);

  const result = await prisma.order.findUnique({
    where: { publicNumber: number },
    include: {
      items: true,
      addresses: {
        where: { type: "shipping" },
        take: 1,
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      quotes: {
        where: { selectedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!result) notFound();

  const order = asRecord(result);
  const ownerId = order.userId;
  const guestEmail = firstText(order, ["guestEmail"], "").trim().toLowerCase();
  const customerEmail = String(customer.email ?? "")
    .trim()
    .toLowerCase();
  const isOwner =
    ownerId === customer.id ||
    (ownerId === null && guestEmail.length > 0 && guestEmail === customerEmail);

  if (!isOwner) notFound();

  const items = asRecordArray(order.items);
  const shippingAddress = asRecordArray(order.addresses)[0] ?? {};
  const payment = asRecordArray(order.payments)[0] ?? {};
  const shipment = asRecordArray(order.shipments)[0] ?? {};
  const warehouseId = firstValue(shipment, ["warehouseId"]);

  let warehouse: UnknownRecord = {};
  if (warehouseId !== undefined && warehouseId !== null) {
    const warehouseResult = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    } as never);
    warehouse = asRecord(warehouseResult);
  }

  if (Object.keys(warehouse).length === 0) {
    // Sesuaikan `isDefault` bila schema Anda memakai nama seperti `isPrimary`.
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { isDefault: true },
    } as never);
    warehouse = asRecord(defaultWarehouse);
  }

  const publicNumber = firstText(order, ["publicNumber"], number);
  const state = firstText(order, ["paymentState"], "pending").toLowerCase();
  const paymentDescription = "QRIS";

  const recipientName = firstText(shippingAddress, [
    "contactName",
    "recipientName",
    "name",
    "fullName",
  ], firstText(order, ["guestName"], "-"));

  const recipientPhone = firstText(shippingAddress, [
    "contactPhone",
    "phone",
    "phoneNumber",
    "recipientPhone",
  ], firstText(order, ["guestPhone"], "-"));

  const selectedQuote = asRecordArray(order.quotes)[0] ?? {};
  const { getCourierDisplayName } = await import("@/lib/shipping-utils");
  const courierName = firstText(shipment, ["courierName"], firstText(selectedQuote, ["courierName"], "")).trim();
  const courierCompany = firstText(shipment, ["courierCompany"], firstText(selectedQuote, ["courierCompany"], "")).trim();
  const courierType = firstText(shipment, ["courierType"], firstText(selectedQuote, ["courierType"], "")).trim();
  const courierLabel = getCourierDisplayName(courierName, courierCompany, courierType);

  const rawWaybill = firstText(
    shipment,
    ["waybillId", "trackingId", "waybillNumber", "trackingNumber"],
    "",
  ).trim();
  const waybill = rawWaybill && !rawWaybill.startsWith("claim_")
    ? rawWaybill
    : "Menunggu Resi";
  const subtotal = firstValue(order, ["subtotal"]);
  const shippingFee = firstValue(order, ["shippingFee"]);
  const serviceFee = firstValue(order, ["serviceFee"]);
  const grandTotal = firstValue(order, ["grandTotal"]);
  const query = await searchParams;
  const autoPrint =
    query.print === "1" ||
    (Array.isArray(query.print) && query.print[0] === "1");

  return (
    <main className={styles.pageShell}>
      <div className={styles.actions} data-print-hidden>
        <Link
          href={`/orders/${encodeURIComponent(publicNumber)}`}
          className={styles.backButton}
        >
          ← Kembali
        </Link>
        <PrintInvoiceButton autoPrint={autoPrint} />
      </div>

      <article
        className={styles.invoice}
        aria-label={`Invoice ${publicNumber}`}
      >
        <div className={styles.brandRule} />

        <section className={styles.invoiceHeader}>
          <div>
            <p className={styles.brand}>REMPAHKARTA</p>
            <p className={styles.brandTagline}>
              Hangatkan Keluarga Indonesia!
            </p>
          </div>
          <div className={styles.invoiceTitle}>
            <h1>INVOICE PENJUALAN</h1>
            <p>{publicNumber}</p>
          </div>
        </section>

        <section className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span>Tanggal Pemesanan</span>
            <strong>{formatDate(firstValue(order, ["createdAt"]))}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Status Pembayaran</span>
            <strong
              className={
                state === "paid" ? styles.statusPaid : styles.statusPending
              }
            >
              {paymentLabel(state)}
            </strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Metode Pembayaran</span>
            <strong>{paymentDescription}</strong>
          </div>
          <div className={styles.summaryItem}>
            <span>Nomor Invoice</span>
            <strong>{publicNumber}</strong>
          </div>
        </section>

        <section className={styles.partiesGrid}>
          <div className={styles.partyCard}>
            <p className={styles.sectionEyebrow}>PENERIMA</p>
            <h2>
              {recipientName}
            </h2>
            <p>
              {recipientPhone}
            </p>
            <p>{completeAddress(shippingAddress)}</p>
            <p>
              Kode Pos: {firstText(shippingAddress, ["postalCode", "zipCode"])}
            </p>
          </div>

          <div className={styles.partyCard}>
            <p className={styles.sectionEyebrow}>PENGIRIM</p>
            <h2>
              {firstText(
                warehouse,
                ["contactName", "name"],
                "REMPAHKARTA",
              )}
            </h2>
            <p>{firstText(warehouse, ["contactPhone", "phone"], "-")}</p>
            <p>{completeAddress(warehouse)}</p>
            <p>Kode Pos: {firstText(warehouse, ["postalCode", "zipCode"])}</p>
          </div>
        </section>

        <section className={styles.itemsSection}>
          <h2>Rincian Pesanan</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Produk &amp; Varian</th>
                  <th className={styles.numeric}>Harga Satuan</th>
                  <th className={styles.quantity}>Jumlah</th>
                  <th className={styles.numeric}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const quantity = toPositiveInteger(
                    firstValue(item, ["quantity", "qty"]),
                  );
                  const unitPrice = toBigInt(
                    firstValue(item, ["unitPrice", "price"]),
                  );
                  const storedTotal = firstValue(item, [
                    "total",
                    "lineTotal",
                    "subtotal",
                  ]);
                  const lineTotal =
                    storedTotal === undefined
                      ? unitPrice * BigInt(quantity)
                      : toBigInt(storedTotal);
                  const variants = optionsLabel(
                    firstValue(item, ["optionsSnapshot", "options"]),
                  );

                  return (
                    <tr key={firstText(item, ["id"], String(index))}>
                      <td>
                        <strong>
                          {firstText(
                            item,
                            ["productName", "name", "nameSnapshot"],
                            "Produk",
                          )}
                        </strong>
                        {variants && (
                          <span className={styles.variant}>{variants}</span>
                        )}
                      </td>
                      <td className={styles.numeric}>
                        {formatRupiah(unitPrice)}
                      </td>
                      <td className={styles.quantity}>{quantity}</td>
                      <td className={styles.numeric}>
                        {formatRupiah(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.totalsSection}>
          <div className={styles.invoiceNote}>
            <p className={styles.sectionEyebrow}>CATATAN</p>
            <p>Simpan invoice ini sebagai bukti transaksi yang sah.</p>
          </div>
          <dl className={styles.totals}>
            <div>
              <dt>Total Belanja</dt>
              <dd>{formatRupiah(subtotal)}</dd>
            </div>
            <div>
              <dt>Ongkos Kirim</dt>
              <dd>{formatRupiah(shippingFee)}</dd>
            </div>
            {toBigInt(serviceFee) > 0 && (
              <div>
                <dt>Biaya Layanan</dt>
                <dd>{formatRupiah(serviceFee)}</dd>
              </div>
            )}
            <div className={styles.grandTotal}>
              <dt>Total Pembayaran</dt>
              <dd>{formatRupiah(grandTotal)}</dd>
            </div>
          </dl>
        </section>

        <footer className={styles.invoiceFooter}>
          <p>TERIMA KASIH UNTUK TRANSAKSI ANDA.</p>
          <p>
            Dokumen ini dibuat secara elektronik dan tidak memerlukan tanda
            tangan.
          </p>
        </footer>
      </article>
    </main>
  );
}
