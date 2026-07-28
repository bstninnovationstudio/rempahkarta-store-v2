import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { checkAndExpireOrder } from "@/lib/payment-sync";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCourierDisplayName } from "@/lib/shipping-utils";

// ────────────────────────────────────────────────────────
// PDF generation helpers (jsPDF)
// ────────────────────────────────────────────────────────

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value))
    return BigInt(Math.trunc(value));
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return BigInt(0);
  }
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

function optionsLabel(value: unknown): string {
  if (!value) return "";
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return value; }
  }
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return Object.values(parsed as Record<string, unknown>)
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

function completeAddress(address: Record<string, unknown>): string {
  const parts = [
    address.address || address.fullAddress || address.addressLine || "",
    address.postalCode ? `Kode Pos ${address.postalCode}` : "",
  ].filter(Boolean);
  return parts.join(", ") || "-";
}

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

// ────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  try {
    const { number } = await params;

    // Auth + ownership
    const customer = await customerFromRequest();
    if (!customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = checkRateLimit(request, {
      scope: "invoice-pdf",
      identity: customer.id,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) return rateLimitResponse(rate);

    const ownedOrder = await prisma.order.findUnique({
      where: { publicNumber: number },
      select: { id: true, userId: true, guestEmail: true },
    });
    if (!ownedOrder) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }
    const isOwner =
      ownedOrder.userId === customer.id ||
      (ownedOrder.userId === null &&
        ownedOrder.guestEmail.toLowerCase() === customer.email.toLowerCase());
    if (!isOwner) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    await checkAndExpireOrder(ownedOrder.id);

    // Full query
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: ownedOrder.id },
      include: {
        items: true,
        addresses: { where: { type: "shipping" }, take: 1 },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        shipments: { orderBy: { createdAt: "desc" }, take: 1 },
        quotes: { where: { selectedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    // Warehouse
    let warehouse: Record<string, unknown> = {};
    const shipment = order.shipments[0];
    if (shipment?.warehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: shipment.warehouseId } } as never);
      if (wh) warehouse = wh as unknown as Record<string, unknown>;
    }
    if (!warehouse.id) {
      const defaultWh = await prisma.warehouse.findFirst({ where: { isDefault: true } } as never);
      if (defaultWh) warehouse = defaultWh as unknown as Record<string, unknown>;
    }

    const shippingAddress = order.addresses[0];
    const payment = order.payments[0];
    const selectedQuote = order.quotes[0];

    const courierLabel = getCourierDisplayName(
      shipment?.courierName || selectedQuote?.courierName,
      shipment?.courierCompany || selectedQuote?.courierCompany,
      shipment?.courierType || selectedQuote?.courierType,
    );

    const rawWaybill = shipment?.waybillId || shipment?.trackingId || "";
    const waybill = rawWaybill && !rawWaybill.startsWith("claim_") ? rawWaybill : "Menunggu Resi";

    const paymentState = order.paymentState.toLowerCase();
    const paymentLabel = PAYMENT_LABELS[paymentState] ?? paymentState;

    const subtotal = Number(order.subtotal || 0);
    const shippingFee = Number(order.shippingFee || 0);
    const discountAmount = Number(order.discountAmount || 0);
    const serviceFee = Number(order.serviceFee || 0);
    const grandTotal = Number(order.grandTotal || 0);
    const payableAmount = payment?.payableAmount ? Number(payment.payableAmount) : grandTotal;
    const uniqueCode = payment?.uniqueCode !== undefined
      ? Number(payment.uniqueCode)
      : Math.max(0, payableAmount - grandTotal);

    // ── Build PDF with jsPDF ──
    const { default: jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 17;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const green = [52, 75, 58] as [number, number, number];
    const darkText = [34, 39, 35] as [number, number, number];
    const grayText = [100, 107, 101] as [number, number, number];
    const lightGray = [200, 205, 198] as [number, number, number];

    let y = 18;

    // Brand accent bar
    doc.setFillColor(...green);
    doc.roundedRect(margin, y, 40, 4, 2, 2, "F");
    y += 12;

    // Header: brand + invoice title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...green);
    doc.text("REMPAHKARTA", margin, y);

    doc.setFontSize(18);
    doc.setTextColor(...darkText);
    doc.text("INVOICE PENJUALAN", pageWidth - margin, y, { align: "right" });
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text("Hangatkan Keluarga Indonesia!", margin, y);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...green);
    doc.text(order.publicNumber, pageWidth - margin, y, { align: "right" });
    y += 5;

    // Divider
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Summary grid
    const summaryItems = [
      { label: "TANGGAL PEMESANAN", value: formatDate(order.createdAt) },
      { label: "STATUS PEMBAYARAN", value: paymentLabel },
      { label: "METODE PEMBAYARAN", value: "QRIS" },
      { label: "NOMOR INVOICE", value: order.publicNumber },
    ];

    const colWidth = contentWidth / 4;
    summaryItems.forEach((item, i) => {
      const x = margin + i * colWidth;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...grayText);
      doc.text(item.label, x + 2, y);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkText);
      const lines = doc.splitTextToSize(item.value, colWidth - 6);
      doc.text(lines, x + 2, y + 5);

      // Vertical separator
      if (i > 0) {
        doc.setDrawColor(220, 224, 218);
        doc.line(x, y - 3, x, y + 10);
      }
    });
    y += 17;

    // Divider
    doc.setDrawColor(...lightGray);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Parties grid: Penerima + Pengirim
    const partyColWidth = contentWidth / 2;

    // Penerima
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...green);
    doc.text("PENERIMA", margin, y);

    doc.setFontSize(7);
    doc.text("PENGIRIM", margin + partyColWidth + 10, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...darkText);
    const recipientName = shippingAddress?.contactName || order.guestName || "-";
    doc.text(recipientName, margin, y);

    const senderName = String(warehouse.contactName || warehouse.name || "REMPAHKARTA");
    doc.text(senderName, margin + partyColWidth + 10, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...grayText);
    const recipientPhone = shippingAddress?.contactPhone || order.guestPhone || "-";
    doc.text(String(recipientPhone), margin, y);

    doc.text(String(warehouse.contactPhone || warehouse.phone || "-"), margin + partyColWidth + 10, y);
    y += 5;

    const recipientAddress = shippingAddress
      ? completeAddress(shippingAddress as unknown as Record<string, unknown>)
      : "Alamat tersimpan";
    const recipientLines = doc.splitTextToSize(recipientAddress, partyColWidth - 5);
    doc.text(recipientLines, margin, y);

    const senderAddress = completeAddress(warehouse);
    const senderLines = doc.splitTextToSize(senderAddress, partyColWidth - 15);
    doc.text(senderLines, margin + partyColWidth + 10, y);
    y += Math.max(recipientLines.length, senderLines.length) * 4 + 4;

    // Postal codes
    if (shippingAddress?.postalCode) {
      doc.text(`Kode Pos: ${shippingAddress.postalCode}`, margin, y);
    }
    if (warehouse.postalCode) {
      doc.text(`Kode Pos: ${warehouse.postalCode}`, margin + partyColWidth + 10, y);
    }
    y += 8;

    // Shipping info
    doc.setFillColor(245, 246, 243);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...grayText);
    doc.text("KURIR", margin + 4, y + 5);
    doc.text("NOMOR RESI", margin + contentWidth / 2 + 4, y + 5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.text(courierLabel, margin + 4, y + 10);
    doc.text(waybill, margin + contentWidth / 2 + 4, y + 10);
    y += 20;

    // Items table
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.text("Rincian Pesanan", margin, y);
    y += 4;

    const tableBody = order.items.map((item) => {
      const qty = item.quantity;
      const unitPrice = Number(item.unitPrice);
      const lineTotal = unitPrice * qty;
      const opts = optionsLabel(item.optionsSnapshot);
      const name = item.nameSnapshot || "Produk";
      return [
        opts ? `${name}\n${opts}` : name,
        formatRupiah(unitPrice),
        String(qty),
        formatRupiah(lineTotal),
      ];
    });

    if (typeof autoTable === "function") {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Produk & Varian", "Harga Satuan", "Jml", "Total"]],
        body: tableBody,
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 },
          textColor: darkText,
          lineColor: [226, 229, 225],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [245, 246, 243],
          textColor: [80, 87, 80],
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 32, halign: "right" },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 32, halign: "right" },
        },
        theme: "plain",
        tableLineColor: [226, 229, 225],
        tableLineWidth: 0.2,
      });
    } else if (typeof (doc as unknown as Record<string, unknown>).autoTable === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Produk & Varian", "Harga Satuan", "Jml", "Total"]],
        body: tableBody,
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 },
          textColor: darkText,
          lineColor: [226, 229, 225],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [245, 246, 243],
          textColor: [80, 87, 80],
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 32, halign: "right" },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 32, halign: "right" },
        },
        theme: "plain",
        tableLineColor: [226, 229, 225],
        tableLineWidth: 0.2,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastTable = (doc as any).lastAutoTable;
    y = (lastTable?.finalY ?? y + 30) + 8;

    // Totals section
    const totalsX = pageWidth - margin - 80;
    const valueX = pageWidth - margin;

    const totalRows: Array<{ label: string; value: string; bold?: boolean; green?: boolean }> = [
      { label: "Total Belanja", value: formatRupiah(subtotal) },
      { label: "Ongkos Kirim", value: formatRupiah(shippingFee) },
    ];
    if (discountAmount > 0) {
      const discountLabel = order.voucherCode ? `Diskon Promo (${order.voucherCode})` : "Diskon Promo";
      totalRows.push({ label: discountLabel, value: `-${formatRupiah(discountAmount)}` });
    }
    if (serviceFee > 0) {
      totalRows.push({ label: "Biaya Layanan", value: formatRupiah(serviceFee) });
    }
    if (uniqueCode > 0) {
      totalRows.push({ label: "Nomor Acak Unik", value: formatRupiah(uniqueCode) });
    }
    totalRows.push({ label: "Total Pembayaran", value: formatRupiah(payableAmount), bold: true, green: true });

    // Note on left side
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...green);
    doc.text("CATATAN", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...grayText);
    const noteLines = doc.splitTextToSize("Simpan invoice ini sebagai bukti transaksi yang sah.", 70);
    doc.text(noteLines, margin, y + 5);

    // Totals on right
    totalRows.forEach((row, i) => {
      const isLast = i === totalRows.length - 1;
      if (isLast) {
        // Grand total separator
        doc.setDrawColor(...green);
        doc.setLineWidth(0.6);
        doc.line(totalsX, y - 1, valueX, y - 1);
        y += 3;
      }

      doc.setFontSize(row.bold ? 11 : 9);
      doc.setFont("helvetica", row.bold ? "bold" : "normal");
      doc.setTextColor(...(row.green ? green : grayText));
      doc.text(row.label, totalsX, y);

      doc.setFont("helvetica", row.bold ? "bold" : "bold");
      doc.setTextColor(...(row.green ? green : darkText));
      doc.text(row.value, valueX, y, { align: "right" });
      y += row.bold ? 7 : 5;
    });

    // Footer
    y = Math.max(y + 15, 270);
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text("TERIMA KASIH UNTUK TRANSAKSI ANDA.", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.text(
      "Dokumen ini dibuat secara elektronik dan tidak memerlukan tanda tangan.",
      pageWidth / 2,
      y,
      { align: "center" },
    );

    // Output
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `Invoice-${order.publicNumber}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Invoice PDF Route Error]:", error);
    return NextResponse.json(
      { error: "Gagal membuat PDF invoice" },
      { status: 500 }
    );
  }
}
