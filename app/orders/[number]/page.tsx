import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, MapPin, PackageOpen, RotateCcw, Truck } from "lucide-react";
import { StatusPill, type StatusKey } from "@/components/status-pill";
import { StoreHeader } from "@/components/store-header";
import { OrderCancelButton } from "@/components/order-cancel-button";
import { OrderTrackingButton } from "@/components/order-tracking-button";
import { products } from "@/lib/demo-data";
import { rupiah } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { customerFromRequest } from "@/lib/customer-auth";
import { HolidayNoticeBanner } from "@/components/holiday-notice-banner";
import { InvoiceDownloadButton } from "@/components/invoice-download-button";
import { formatCustomerShipmentEvent, getCustomerShipmentStatusDetail } from "@/lib/shipment-event";
import { turnstileSiteKey } from "@/lib/turnstile";

const demoEvents = [
  { at: "13 Jul\n14.32", title: "Paket dalam perjalanan ke kota tujuan", note: "JNE Jakarta Gateway", tone: "info" as const },
  { at: "13 Jul\n12.08", title: "Paket telah diambil kurir", note: "Gudang Rempahkarta, Jakarta Selatan", tone: "info" as const },
  { at: "13 Jul\n10.17", title: "Pesanan selesai dikemas", note: "Menunggu pickup JNE Regular", tone: "info" as const },
  { at: "13 Jul\n09.44", title: "Pembayaran QRIS berhasil", note: "Pesanan diteruskan ke tim fulfillment", tone: "success" as const },
];

type AuditLogView = { action: string; after: unknown; createdAt: Date };
type SemanticTone = "success" | "info" | "warning" | "danger";
type TimelineEventView = {
  at: string;
  dateTime?: string;
  title: string;
  note: string;
  tone: SemanticTone;
};
type OrderItemView = {
  id: string;
  sku: string;
  name: string;
  options: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: string | null;
};
type ReturnItemView = OrderItemView;
type ReturnView = {
  id: string;
  state: string;
  reason: string;
  description: string;
  decisionReason: string | null;
  refundAmount: number;
  source: string;
  cause: string | null;
  evidence: string[];
  items: ReturnItemView[];
  refund: {
    amount: number;
    method: string | null;
    reference: string | null;
    proofObjectKey: string | null;
    processedAt: string | null;
  } | null;
};
type OrderView = {
  created: string;
  expiresAtFormatted?: string | null;
  status: OrderStatus;
  displayStatus: StatusKey;
  events: TimelineEventView[];
  items: OrderItemView[];
  shipping: number;
  voucherCode: string | null;
  discountAmount: number;
  serviceFee: number;
  uniqueCode: number;
  total: number;
  courier: string;
  tracking: string;
  hasResi: boolean;
  recipient: string;
  address: string;
  phone: string;
  canReturn: boolean;
  canCancel: boolean;
  isPast7Days: boolean;
  hasRefundInfo: boolean;
  userId: string | null;
  paymentState: StatusKey;
  paymentUrl: string | null;
  returnState: string | null;
  cancellationState: string | null;
  cancellationReason: string | null;
  cancellationDecisionReason: string | null;
  isSellerCancelled: boolean;
  issueOrder: boolean;
  returnObj: ReturnView | null;
};

const returnStateMeta: Record<string, { label: string; description: string; tone: SemanticTone }> = {
  requested: { label: "Menunggu peninjauan", description: "Pengajuan sudah diterima dan menunggu pemeriksaan dari tim toko.", tone: "warning" },
  under_review: { label: "Sedang ditinjau", description: "Tim toko sedang memeriksa detail pengajuan dan bukti yang dikirim.", tone: "info" },
  approved: { label: "Pengajuan disetujui", description: "Pengajuan diterima. Ikuti instruksi berikutnya yang diberikan oleh tim toko.", tone: "success" },
  awaiting_handover: { label: "Menunggu pengembalian barang", description: "Barang menunggu diserahkan untuk proses pengembalian.", tone: "warning" },
  waiting_waybill: { label: "Menunggu resi pengembalian", description: "Nomor resi pengembalian belum tersedia.", tone: "warning" },
  in_transit: { label: "Dalam perjalanan kembali", description: "Barang sedang dikirim kembali kepada penjual.", tone: "info" },
  processing_return: { label: "Pengembalian diproses", description: "Barang pengembalian sedang diproses oleh penjual.", tone: "info" },
  received: { label: "Barang diterima penjual", description: "Barang pengembalian telah diterima dan menunggu pemeriksaan.", tone: "info" },
  return_complete: { label: "Pengembalian selesai", description: "Proses pengembalian barang telah selesai.", tone: "success" },
  inspection_passed: { label: "Lolos pemeriksaan", description: "Barang telah lolos pemeriksaan dan refund dapat dilanjutkan.", tone: "success" },
  inspection_failed: { label: "Tidak lolos pemeriksaan", description: "Barang tidak lolos pemeriksaan. Lihat alasan keputusan bila tersedia.", tone: "danger" },
  awaiting_approval: { label: "Menunggu persetujuan", description: "Rincian resolusi menunggu persetujuan tim toko.", tone: "warning" },
  refund_pending: { label: "Menunggu transfer refund", description: "Nominal refund telah disetujui dan menunggu proses transfer.", tone: "warning" },
  processing_refund: { label: "Refund sedang ditransfer", description: "Pengembalian dana sedang diproses ke rekening atau e-wallet tersimpan.", tone: "info" },
  refunded: { label: "Refund selesai", description: "Pengembalian dana telah dikirim.", tone: "success" },
  rejected: { label: "Pengajuan ditolak", description: "Pengajuan tidak dapat dilanjutkan. Lihat alasan keputusan bila tersedia.", tone: "danger" },
  cancelled: { label: "Resolusi dibatalkan", description: "Proses resolusi dihentikan. Lihat alasan keputusan bila tersedia.", tone: "danger" },
  closed: { label: "Resolusi ditutup", description: "Kasus telah ditutup dan tidak memerlukan tindakan lanjutan.", tone: "success" },
  finished: { label: "Resolusi selesai", description: "Seluruh proses resolusi telah selesai.", tone: "success" },
};

const cancellationStateMeta: Record<string, { label: string; description: string; tone: SemanticTone }> = {
  requested: { label: "Menunggu peninjauan", description: "Pengajuan pembatalan sedang ditinjau oleh tim toko.", tone: "warning" },
  provider_pending: { label: "Sedang diproses", description: "Pembatalan sedang diteruskan ke penyedia pengiriman.", tone: "info" },
  provider_failed: { label: "Perlu ditinjau ulang", description: "Pembatalan belum berhasil diproses oleh penyedia pengiriman. Tim toko akan meninjau ulang.", tone: "danger" },
  approved: { label: "Disetujui", description: "Pengajuan pembatalan telah disetujui.", tone: "success" },
  rejected: { label: "Ditolak", description: "Pengajuan pembatalan ditolak dan pesanan tetap mengikuti status pemrosesan di atas.", tone: "danger" },
};

const returnCauseLabels: Record<string, string> = {
  damaged: "Produk rusak atau cacat",
  wrong: "Produk atau varian tidak sesuai",
  incomplete: "Pesanan tidak lengkap",
};

const machineWordLabels: Record<string, string> = {
  allocated: "dialokasikan", cancelled: "dibatalkan", completed: "selesai", confirmed: "dikonfirmasi", courier: "kurir", created: "dibuat",
  delivered: "terkirim", delivery: "pengiriman", disposed: "dimusnahkan", driver: "kurir", dropping: "pengantaran", failed: "gagal",
  found: "ditemukan", handover: "serah terima", hold: "ditahan", in: "dalam", not: "tidak", pending: "menunggu",
  order: "pesanan", picked: "dijemput", picking: "penjemputan", pickup: "penjemputan",
  price: "ongkir", rejected: "ditolak", return: "pengembalian", returned: "dikembalikan",
  scheduled: "dijadwalkan", success: "berhasil", transit: "perjalanan", updated: "diperbarui", waybill: "resi",
};

const defaultSystemReasons = new Set([
  "dibatalkan langsung oleh admin",
  "dibatalkan oleh penjual",
  "kebijakan penjual",
  "kebijakan penjual.",
  "pesanan tetap diproses",
  "pesanan tetap diproses.",
  "proses refund sedang disiapkan",
  "proses refund sedang disiapkan.",
  "tidak memenuhi kriteria kebijakan",
  "tidak memenuhi kriteria kebijakan.",
]);

function humanizeMachineValue(value: string) {
  const words = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => machineWordLabels[word] || word);
  const label = words.join(" ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Pembaruan pengiriman";
}

function meaningfulReason(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned && !defaultSystemReasons.has(cleaned.toLowerCase()) ? cleaned : null;
}

function getTimelineTone(title: string): SemanticTone {
  const normalized = title.toLowerCase();
  if (/gagal|ditolak|dibatalkan|kadaluwarsa|dimusnahkan|tidak tersedia|bermasalah/.test(normalized)) return "danger";
  if (/menunggu|diajukan|ditahan|dijadwalkan/.test(normalized)) return "warning";
  if (/selesai|berhasil|diterima|terkirim|dikembalikan/.test(normalized)) return "success";
  return "info";
}

function StatusBadge({ label, tone }: { label: string; tone: SemanticTone }) {
  return <span className={`status-pill status-tone-${tone}`} aria-label={`Status: ${label}`}>{label}</span>;
}

function OrderInfoTable({ rows, label }: { rows: Array<{ label: string; value: ReactNode; className?: string }>; label: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="order-info-table-wrap">
      <table className="order-info-table" aria-label={label}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td className={row.className}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrackingProgress({ steps, activeIndex, tone, label }: { steps: string[]; activeIndex: number; tone: SemanticTone; label: string }) {
  const safeActiveIndex = Math.max(0, Math.min(activeIndex, steps.length - 1));
  return (
    <div className="tracking-progress-wrap">
      <ol className={`tracking-progress steps-${steps.length} progress-tone-${tone} ${steps.length === 1 ? "no-line" : ""}`} aria-label={label}>
        {steps.map((step, index) => (
          <li
            className={`tracking-step ${index < safeActiveIndex ? "done" : ""} ${index === safeActiveIndex ? "active" : ""}`}
            aria-current={index === safeActiveIndex ? "step" : undefined}
            key={step}
          >
            <span className="tracking-step-label">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function getOrderProgress(view: OrderView) {
  if (view.returnObj) {
    const state = view.returnObj.state;
    const isRejected = ["rejected", "inspection_failed", "cancelled"].includes(state);
    const isFinished = ["refunded", "closed", "finished", "return_complete"].includes(state);
    const isRefundOnly = view.returnObj.reason === "refund";
    const steps = ["Pengajuan", "Peninjauan", isRefundOnly ? "Proses refund" : "Pengembalian", isRejected ? "Ditolak" : "Selesai"];
    const activeIndex = isRejected || isFinished
      ? 3
      : ["requested", "under_review", "awaiting_approval"].includes(state)
        ? 1
        : 2;
    const tone: SemanticTone = isRejected ? "danger" : isFinished ? "success" : ["requested", "awaiting_approval", "waiting_waybill", "refund_pending"].includes(state) ? "warning" : "info";
    return { steps, activeIndex, tone, label: "Tahap resolusi pesanan" };
  }

  if (view.cancellationState) {
    const state = view.cancellationState;
    const needsRefund = ["paid", "refund_pending", "refunded", "partially_refunded"].includes(view.paymentState);
    if (state === "approved" && needsRefund) {
      const activeIndex = view.paymentState === "refunded" ? 3 : 2;
      return { steps: ["Pembatalan", "Disetujui", "Proses refund", "Selesai"], activeIndex, tone: activeIndex === 3 ? "success" as const : "info" as const, label: "Tahap pembatalan dan refund" };
    }
    if (state === "approved") {
      return { steps: ["Pembatalan", "Disetujui", "Selesai"], activeIndex: 2, tone: "success" as const, label: "Tahap pembatalan pesanan" };
    }
    if (state !== "rejected") {
      return {
        steps: ["Pengajuan", "Peninjauan", "Keputusan"],
        activeIndex: 1,
        tone: state === "provider_failed" ? "danger" as const : "warning" as const,
        label: "Tahap pengajuan pembatalan",
      };
    }
  }

  if (view.displayStatus === "cancel_requested") {
    return {
      steps: ["Pengajuan", "Peninjauan", "Keputusan"],
      activeIndex: 1,
      tone: "warning" as const,
      label: "Tahap pengajuan pembatalan",
    };
  }

  if (view.issueOrder) {
    const isRefunded = view.paymentState === "refunded";
    const hasRefund = ["refund_pending", "refunded", "partially_refunded"].includes(view.paymentState);
    return {
      steps: ["Kendala", "Investigasi", hasRefund ? "Proses refund" : "Resolusi", "Selesai"],
      activeIndex: isRefunded ? 3 : hasRefund ? 2 : 1,
      tone: isRefunded ? "success" as const : "danger" as const,
      label: "Tahap penanganan kendala pesanan",
    };
  }

  if (view.status === "cancelled" || view.displayStatus === "cancelled") {
    const needsRefund = ["paid", "refund_pending", "refunded", "partially_refunded"].includes(view.paymentState);
    if (needsRefund) {
      const activeIndex = view.paymentState === "refunded" ? 2 : 1;
      return {
        steps: ["Dibatalkan", "Proses refund", "Selesai"],
        activeIndex,
        tone: activeIndex === 2 ? "success" as const : "danger" as const,
        label: "Tahap pembatalan dan refund",
      };
    }
    return { steps: ["Pesanan dibatalkan"], activeIndex: 0, tone: "danger" as const, label: "Status akhir pesanan" };
  }

  if (["refund_pending", "refunded", "partially_refunded"].includes(view.paymentState)) {
    const activeIndex = view.paymentState === "refunded" ? 2 : 1;
    return {
      steps: ["Refund diajukan", "Diproses", "Selesai"],
      activeIndex,
      tone: activeIndex === 2 ? "success" as const : "warning" as const,
      label: "Tahap pengembalian dana",
    };
  }

  if (["expired", "canceled", "failed", "denied"].includes(view.paymentState)) {
    const labels: Partial<Record<StatusKey, string>> = {
      expired: "Pembayaran kedaluwarsa",
      canceled: "Pembayaran dibatalkan",
      failed: "Pembayaran gagal",
      denied: "Pembayaran ditolak",
    };
    return { steps: [labels[view.paymentState] || "Pesanan dihentikan"], activeIndex: 0, tone: "danger" as const, label: "Status akhir pesanan" };
  }

  if (view.displayStatus === "awaiting_payment") {
    return { steps: ["Pembayaran", "Diproses", "Dikirim", "Terkirim"], activeIndex: 0, tone: "warning" as const, label: "Tahap pemrosesan pesanan" };
  }

  if (["return_requested", "return_in_transit", "returned"].includes(view.displayStatus)) {
    const returnIndex: Partial<Record<StatusKey, number>> = { return_requested: 0, return_in_transit: 2, returned: 3 };
    const activeIndex = returnIndex[view.displayStatus] ?? 0;
    return {
      steps: ["Retur diajukan", "Disiapkan", "Dalam perjalanan", "Diterima"],
      activeIndex,
      tone: activeIndex === 3 ? "success" as const : "info" as const,
      label: "Tahap pengembalian barang",
    };
  }

  const fulfillmentIndex: Partial<Record<StatusKey, number>> = {
    awaiting_processing: 0,
    processing: 0,
    packed: 1,
    shipment_booked: 1,
    handover_pending: 1,
    handed_over: 2,
    in_transit: 2,
    completed: 3,
    delivered: 3,
    finished: 3,
    return_requested: 1,
    return_in_transit: 2,
    returned: 3,
  };
  const activeIndex = fulfillmentIndex[view.displayStatus] ?? 0;
  return {
    steps: ["Diproses", "Dikemas", "Diserahkan ke kurir", "Terkirim"],
    activeIndex,
    tone: activeIndex === 3 ? "success" as const : "info" as const,
    label: "Tahap pemrosesan dan pengiriman pesanan",
  };
}

function hasFulfillmentState(value: unknown, state: string) {
  return typeof value === "object"
    && value !== null
    && "fulfillmentState" in value
    && (value as { fulfillmentState?: unknown }).fulfillmentState === state;
}

function uiStatus(value: string): OrderStatus {
  if (["packed", "shipment_booked"].includes(value)) return "processing";
  if (["handed_over", "return_in_transit"].includes(value)) return "in_transit";
  if (["returned", "finished"].includes(value)) return "completed";
  if (["cancel_requested"].includes(value)) return "processing";
  return (["awaiting_payment", "awaiting_processing", "processing", "handover_pending", "completed", "cancelled", "finished"] as string[]).includes(value)
    ? (value === "finished" ? "completed" : value as OrderStatus)
    : "awaiting_processing";
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const product = products[0];
  let view: OrderView = {
    created: "13 Juli 2026, 09.42 WIB",
    status: "in_transit" as OrderStatus,
    displayStatus: "in_transit" as StatusKey,
    events: demoEvents,
    items: [{
      id: "demo-item",
      sku: "REMPAH-DEMO",
      name: product.name,
      options: "Regular · 100 g",
      quantity: 1,
      unitPrice: product.price,
      lineTotal: product.price,
      image: product.image || "/demo/banner.webp",
    }],
    shipping: 19000,
    voucherCode: null,
    discountAmount: 0,
    serviceFee: 0,
    uniqueCode: 0,
    total: product.price + 19000,
    courier: "JNE Regular",
    tracking: "RPK128732198",
    hasResi: true,
    recipient: "Budi S••••••",
    address: "Jl. Senopati No. ••, Kebayoran Baru\nJakarta Selatan, 12110",
    phone: "0812••••7890",
    canReturn: true,
    canCancel: false,
    isPast7Days: false,
    hasRefundInfo: false,
    userId: null as string | null,
    paymentState: "paid" as StatusKey,
    paymentUrl: null,
    returnState: null,
    cancellationState: null,
    cancellationReason: null,
    cancellationDecisionReason: null,
    isSellerCancelled: false,
    issueOrder: false,
    returnObj: null,
  };

  let auditLogs: AuditLogView[] = [];

  {
    const customer = await customerFromRequest();
    if (!customer) {
      redirect(`/login?redirect=/orders/${number}`);
    }
    const { prisma } = await import("@/lib/db");
    const { checkAndExpireOrder } = await import("@/lib/payment-sync");

    const order = await prisma.order.findUnique({
      where: { publicNumber: number },
      include: {
        items: true,
        addresses: true,
        shipments: { include: { events: { orderBy: { occurredAt: "desc" } } }, take: 1 },
        quotes: { where: { selectedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 1 },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        returns: {
          include: {
            refunds: { orderBy: { createdAt: "desc" }, take: 1 },
            items: { include: { orderItem: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        cancellations: { orderBy: { requestedAt: "desc" } },
      },
    });
    if (!order) notFound();
    const isOwner = order.userId === customer.id
      || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
    if (!isOwner) notFound();
    if (await checkAndExpireOrder(order.id)) {
      redirect(`/orders/${number}`);
    }
    const variantIds = Array.from(new Set(order.items.map((i) => i.variantId).filter((id): id is string => Boolean(id))));
    const variantRecords = variantIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            imageKey: true,
            product: {
              select: {
                images: { orderBy: { position: "asc" }, take: 1, select: { objectKey: true } },
              },
            },
          },
        })
      : [];
    const variantImageMap = new Map(
      variantRecords.map((v) => [v.id, v.imageKey || v.product?.images[0]?.objectKey || null])
    );
    auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "order",
        entityId: order.id,
        action: { in: ["order.processing", "order.packed", "order.manual_status"] }
      },
      orderBy: { createdAt: "asc" }
    });
    const address = order.addresses.find((entry) => entry.type === "shipping");
    const shipment = order.shipments[0];
    const deliveredEvent = shipment?.events.find(
      (e) => e.providerStatus === "delivered"
    );
    
    let hasRefundInfo = false;
    if (order.userId) {
      const setting = await prisma.userRefundSetting.findUnique({ where: { userId: order.userId } });
      if (setting) {
        if (setting.type === "bank" && setting.bankName && setting.bankNumber && setting.bankOwnerName) {
          hasRefundInfo = true;
        } else if (setting.type === "ewallet" && setting.ewalletName && setting.ewalletNumber && setting.ewalletOwnerName) {
          hasRefundInfo = true;
        }
      }
    }
    const deliveryDate = deliveredEvent ? new Date(deliveredEvent.occurredAt) : order.updatedAt;
    const isPast7Days = order.fulfillmentState === "completed" && (new Date().getTime() - deliveryDate.getTime() > 7 * 24 * 60 * 60 * 1000);
    
    const selectedQuote = order.quotes[0];
    const { getCourierDisplayName } = await import("@/lib/shipping-utils");
    const courierLabel = getCourierDisplayName(
      shipment?.courierName || selectedQuote?.courierName,
      shipment?.courierCompany || selectedQuote?.courierCompany,
      shipment?.courierType || selectedQuote?.courierType,
    );
    const rawWaybill = shipment?.waybillId || shipment?.trackingId;
    const isRealWaybill = Boolean(rawWaybill && !rawWaybill.startsWith("claim_"));
    const hasResi = isRealWaybill;
    const trackingResi = isRealWaybill ? rawWaybill! : "Menunggu resi";
    const paymentExpiresAt = order.payments[0]?.expiresAt;
    const expiresAtFormatted = paymentExpiresAt
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(paymentExpiresAt)
      : null;

    view = {
      created: new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(order.createdAt),
      expiresAtFormatted,
      status: uiStatus(order.fulfillmentState),
      displayStatus: order.fulfillmentState,
      events: (() => {
        const list: Array<{ time: Date; title: string; note: string }> = [];
        
        // 1. Add cancellation state events if any
        order.cancellations.forEach(cancel => {
          const isSeller = cancel.reason === "Dibatalkan langsung oleh admin" || cancel.reason === "Dibatalkan oleh penjual";
          const requestReason = meaningfulReason(cancel.reason);
          const decisionReason = meaningfulReason(cancel.decisionReason);
          
          if (cancel.state === "approved") {
            const isAutoApproved = cancel.decidedBy === "system" || cancel.reason.includes("Kadaluwarsa") || cancel.reason.includes("otomatis");
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: isSeller ? "Dibatalkan oleh Penjual" : "Pembatalan Disetujui",
              note: isSeller
                ? decisionReason ? `Alasan penjual: ${decisionReason}` : "Pesanan dibatalkan oleh penjual."
                : isAutoApproved
                  ? "Pengajuan pembatalan telah disetujui otomatis."
                  : decisionReason ? `Pengajuan disetujui. Keputusan penjual: ${decisionReason}` : "Pengajuan pembatalan telah disetujui."
            });
          } else if (cancel.state === "rejected") {
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: "Pengajuan Pembatalan Ditolak",
              note: decisionReason ? `Keputusan penjual: ${decisionReason}` : "Pengajuan ditolak dan pesanan tetap diproses."
            });
          } else if (cancel.state === "provider_pending") {
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: "Pembatalan Sedang Diproses",
              note: "Permintaan pembatalan sedang diteruskan ke penyedia pengiriman."
            });
          } else if (cancel.state === "provider_failed") {
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: "Pembatalan Bermasalah",
              note: decisionReason || "Pembatalan belum berhasil diproses oleh penyedia pengiriman dan menunggu tinjauan ulang."
            });
          } else if (cancel.state === "requested") {
            list.push({
              time: cancel.requestedAt,
              title: "Pembatalan Diajukan",
              note: requestReason ? `Alasan pembeli: ${requestReason}` : "Pengajuan pembatalan diterima."
            });
          }
          
          // If the request was approved/rejected/provider_failed, also show when it was originally requested by the buyer
          if (cancel.state !== "requested" && !isSeller) {
            list.push({
              time: cancel.requestedAt,
              title: "Pembatalan Diajukan",
              note: requestReason ? `Alasan pembeli: ${requestReason}` : "Pengajuan pembatalan diterima."
            });
          }
        });

        // 1.5. Add return/refund state events if any
        order.returns.forEach(ret => {
          if (ret.state !== "requested") {
            const meta = returnStateMeta[ret.state] || {
              label: "Pembaruan resolusi",
              description: "Status resolusi pesanan telah diperbarui.",
              tone: "info" as const,
            };
            const decisionReason = meaningfulReason(ret.decisionReason);
            list.push({
              time: ret.updatedAt,
              title: meta.label,
              note: decisionReason && ["rejected", "cancelled", "inspection_failed"].includes(ret.state)
                ? `${meta.description} Alasan: ${decisionReason}`
                : meta.description,
            });
          }

          // Always show the original request creation
          const causeLabel = ret.cause ? (returnCauseLabels[ret.cause] || humanizeMachineValue(ret.cause)) : "Masalah pada pesanan";
          list.push({
            time: ret.createdAt,
            title: ret.reason === "refund" ? "Refund Diajukan" : "Resolusi Diajukan",
            note: `${causeLabel}. ${ret.description}`
          });
        });
        
        // 2. Add payment status events if expired or canceled
        if (order.paymentState === "expired") {
          list.push({
            time: order.updatedAt,
            title: "Batas Waktu Pembayaran Habis (Kadaluwarsa)",
            note: "Pesanan dibatalkan otomatis karena tidak ada pembayaran dalam 10 menit."
          });
        } else if (order.paymentState === "canceled" && !order.cancellations[0]) {
          list.push({
            time: order.updatedAt,
            title: "Pembayaran Dibatalkan",
            note: "Pembayaran untuk pesanan ini telah dibatalkan."
          });
        } else if (["failed", "denied"].includes(order.paymentState)) {
          list.push({
            time: order.updatedAt,
            title: order.paymentState === "denied" ? "Pembayaran Ditolak" : "Pembayaran Gagal",
            note: "Pembayaran belum berhasil dikonfirmasi."
          });
        }
        
        // 3. Add Biteship shipment tracking events (most recent first)
        if (shipment?.events.length) {
          list.push(...shipment.events.map((event) => {
            const formatted = formatCustomerShipmentEvent({
              providerStatus: event.providerStatus,
              note: event.note,
              payload: event.payload,
              courierCompany: shipment.courierCompany,
              courierType: shipment.courierType,
            });

            return {
              time: event.occurredAt,
              title: formatted.title,
              note: formatted.note,
            };
          }));
        } else if (shipment) {
          const detail = getCustomerShipmentStatusDetail(shipment.status);
          list.push({
            time: shipment.createdAt,
            title: detail.label === "Pesanan dikonfirmasi" ? "Pengiriman dikonfirmasi" : (detail.label || "Pengiriman di-booking"),
            note: `Pengiriman dikonfirmasi · ${shipment.courierCompany.toUpperCase()} ${shipment.courierType}`
          });
        }

        // 4. Add fulfillment state events (processing / packed)
        // Extract real timestamps from AuditLogs if available
        const processingLog = auditLogs.find(l => 
          l.action === "order.processing" || 
          (l.action === "order.manual_status" && hasFulfillmentState(l.after, "processing"))
        );
        const packedLog = auditLogs.find(l => 
          l.action === "order.packed" || 
          (l.action === "order.manual_status" && hasFulfillmentState(l.after, "packed"))
        );

        if (packedLog) {
          list.push({
            time: packedLog.createdAt,
            title: "Pesanan sudah dikemas",
            note: "Paket telah selesai dikemas dan siap dikirim."
          });
        }
        if (processingLog) {
          list.push({
            time: processingLog.createdAt,
            title: "Pesanan sedang diproses",
            note: "Pesanan dikonfirmasi dan sedang disiapkan oleh penjual."
          });
        }

        // 5. Payment / created entry at the bottom
        const paymentCompleted = ["paid", "refund_pending", "refunded", "partially_refunded"].includes(order.paymentState);
        list.push({
          time: paymentCompleted ? (order.payments[0]?.paidAt || order.createdAt) : order.createdAt,
          title: paymentCompleted ? "Pembayaran QRIS berhasil" : "Menunggu pembayaran QRIS",
          note: paymentCompleted ? "Pesanan diteruskan ke tim fulfillment." : "Status akan diperbarui otomatis."
        });
        
        // Sort chronologically descending
        list.sort((a, b) => b.time.getTime() - a.time.getTime());

        return list.map(event => {
          const d = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(event.time);
          const t = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(event.time).replace(/\./g, ":");
          return {
            at: `${d}\n${t}`,
            dateTime: event.time.toISOString(),
            title: event.title,
            note: event.note,
            tone: getTimelineTone(event.title),
          };
        });
      })(),
      items: order.items.map((orderItem) => {
        const fallbackImage = products.find((p) => p.name === orderItem.nameSnapshot)?.image || "/demo/banner.webp";
        const dbImage = orderItem.variantId ? variantImageMap.get(orderItem.variantId) : null;
        const itemImage = dbImage || fallbackImage;
        return {
          id: orderItem.id,
          sku: orderItem.skuSnapshot,
          name: orderItem.nameSnapshot,
          options: Object.values(orderItem.optionsSnapshot as Record<string, string>).filter(Boolean).join(" · "),
          quantity: orderItem.quantity,
          unitPrice: Number(orderItem.unitPrice),
          lineTotal: Number(orderItem.unitPrice) * orderItem.quantity,
          image: itemImage,
        };
      }),
      shipping: Number(order.shippingFee),
      voucherCode: order.voucherCode,
      discountAmount: Number(order.discountAmount),
      serviceFee: Number(order.serviceFee),
      uniqueCode: Number(order.payments[0]?.uniqueCode || 0),
      total: order.payments[0]?.payableAmount ? Number(order.payments[0].payableAmount) : Number(order.grandTotal),
      courier: courierLabel,
      tracking: trackingResi,
      hasResi,
      recipient: address ? address.contactName : order.guestName,
      address: address ? `${address.address}\n${address.postalCode}` : "Alamat tersimpan",
      phone: address?.contactPhone || order.guestPhone,
      canReturn: order.fulfillmentState === "completed" && !isPast7Days,
      isPast7Days,
      hasRefundInfo,
      userId: order.userId,
      canCancel: order.paymentState === "pending" || (["awaiting_payment", "awaiting_processing"].includes(order.fulfillmentState) && order.cancellations.length === 0),
      paymentState: order.paymentState,
      paymentUrl: order.paymentState === "pending" ? order.payments[0]?.paymentPageUrl || null : null,
      returnState: order.returns[0]?.state || null,
      cancellationState: order.cancellations[0]?.state || null,
      cancellationReason: order.cancellations[0]?.reason || null,
      cancellationDecisionReason: order.cancellations[0]?.decisionReason || null,
      isSellerCancelled: order.cancellations[0] ? (order.cancellations[0].reason === "Dibatalkan langsung oleh admin" || order.cancellations[0].reason === "Dibatalkan oleh penjual") : false,
      issueOrder: order.issueOrder,
      returnObj: order.returns[0] ? {
        id: order.returns[0].id,
        state: order.returns[0].state,
        reason: order.returns[0].reason,
        description: order.returns[0].description,
        decisionReason: order.returns[0].decisionReason,
        refundAmount: Number(order.returns[0].refundAmount || 0),
        source: order.returns[0].source,
        cause: order.returns[0].cause,
        evidence: Array.isArray(order.returns[0].evidence)
          ? order.returns[0].evidence.filter((entry): entry is string => typeof entry === "string")
          : [],
        items: order.returns[0].items.map((returnItem) => {
          const fallbackImage = products.find((p) => p.name === returnItem.orderItem.nameSnapshot)?.image || "/demo/banner.webp";
          const dbImage = returnItem.orderItem.variantId ? variantImageMap.get(returnItem.orderItem.variantId) : null;
          const itemImage = dbImage || fallbackImage;
          return {
            id: returnItem.orderItem.id,
            sku: returnItem.orderItem.skuSnapshot,
            name: returnItem.orderItem.nameSnapshot,
            options: Object.values(returnItem.orderItem.optionsSnapshot as Record<string, string>).filter(Boolean).join(" · "),
            quantity: returnItem.quantity,
            unitPrice: Number(returnItem.orderItem.unitPrice),
            lineTotal: Number(returnItem.orderItem.unitPrice) * returnItem.quantity,
            image: itemImage,
          };
        }),
        refund: order.returns[0].refunds[0] ? {
          amount: Number(order.returns[0].refunds[0].amount),
          method: order.returns[0].refunds[0].method,
          reference: order.returns[0].refunds[0].reference,
          proofObjectKey: order.returns[0].refunds[0].proofObjectKey,
          processedAt: order.returns[0].refunds[0].processedAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(order.returns[0].refunds[0].processedAt) : null,
        } : null
      } : null,
    };
  }

  const progress = getOrderProgress(view);
  const hasResolution = Boolean(
    view.issueOrder
    || view.cancellationState
    || view.returnObj
    || (view.status === "cancelled" && view.paymentState !== "expired")
    || ["cancel_requested", "return_requested", "return_in_transit", "returned"].includes(view.displayStatus)
  );
  const cancellationMeta = view.isSellerCancelled
    ? { label: "Dibatalkan oleh penjual", description: "Pesanan dibatalkan oleh penjual.", tone: "danger" as const }
    : view.cancellationState
      ? cancellationStateMeta[view.cancellationState] || { label: "Status pembatalan diperbarui", description: "Status pembatalan pesanan telah diperbarui.", tone: "info" as const }
      : (view.status === "cancelled" && view.paymentState !== "expired")
        ? { label: "Pesanan dibatalkan", description: "Pesanan ini telah dibatalkan.", tone: "danger" as const }
        : null;
  const cancellationRequestReason = meaningfulReason(view.cancellationReason);
  const cancellationDecisionReason = meaningfulReason(view.cancellationDecisionReason);
  const returnMeta = view.returnObj
    ? returnStateMeta[view.returnObj.state] || { label: "Status resolusi diperbarui", description: "Status resolusi pesanan telah diperbarui.", tone: "info" as const }
    : null;
  const returnDecisionReason = meaningfulReason(view.returnObj?.decisionReason);
  const returnCause = view.returnObj?.cause
    ? returnCauseLabels[view.returnObj.cause] || humanizeMachineValue(view.returnObj.cause)
    : null;

  return (
    <>
      <StoreHeader />
      <main className="simple-page order-detail-page">
        <HolidayNoticeBanner />
        <Link href="/" className="eyebrow order-back-link"><ArrowLeft size={13} /> Kembali ke toko</Link>



        <header className="order-header-card">
          <div className="order-header-top">
            <div className="order-number-box">
              <span className="order-header-label">Nomor pesanan</span>
              <h1 className="order-header-number">{number}</h1>
              <p className="order-time-text">
                <span className="order-time-label">Dibuat</span>
                <time className="order-time-value">{view.created}</time>
              </p>
              {view.expiresAtFormatted && view.paymentState === "pending" && (
                <p className="order-time-text">
                  <span className="order-time-label">Batas pembayaran</span>
                  <time className="order-time-value">{view.expiresAtFormatted}</time>
                </p>
              )}
            </div>
            <div className="order-header-statuses" aria-label="Ringkasan status pesanan">
              <div className="order-header-status-item">
                <span className="order-header-label">Status pemrosesan</span>
                <StatusPill status={view.displayStatus} />
              </div>
              <div className="order-header-status-item">
                <span className="order-header-label">Status pembayaran</span>
                <StatusPill status={view.paymentState} />
              </div>
            </div>
          </div>
        </header>

        {view.issueOrder && (
          <section className="panel notice-card notice-danger order-priority-notice" aria-labelledby="order-review-title">
            <strong id="order-review-title">Pesanan dalam peninjauan</strong>
            <p>Tim toko sedang menangani kendala pada pemrosesan atau pengiriman pesanan ini. Perkembangan terbaru tercatat di perjalanan paket dan pusat resolusi.</p>
          </section>
        )}
        {view.paymentUrl && (
          <section className="panel notice-card payment-notice" aria-labelledby="payment-notice-title">
            <div>
              <strong id="payment-notice-title">Pembayaran belum selesai</strong>
              <p>Lanjutkan melalui halaman pembayaran yang sudah dibuat agar referensi pesanan tetap sama.</p>
            </div>
            <a className="button button-dark" href={view.paymentUrl}>Lanjutkan pembayaran</a>
          </section>
        )}

        <div className="order-layout">
          <div className="order-detail-main">
            <section className="panel order-journey-panel" aria-labelledby="order-journey-title">
            <div className="order-section-heading">
              <div>
                <h2 id="order-journey-title"><Truck size={18} aria-hidden="true" /> Perjalanan paket</h2>
                <span className="order-section-kicker">Status dan riwayat</span>
              </div>
            </div>

            <TrackingProgress {...progress} />

            <div className="timeline" aria-label="Riwayat pesanan">
              {view.events.map((event, index) => (
                <article className={`timeline-item timeline-tone-${event.tone}`} key={`${event.dateTime || event.at}-${index}`}>
                  <time className="timeline-time" dateTime={event.dateTime}>
                    {event.at.split("\n").map((part) => <span key={part}>{part}</span>)}
                  </time>
                  <div className="timeline-marker" aria-hidden="true" />
                  <div className="timeline-content">
                    <strong>{event.title}</strong>
                    <p>{event.note}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="order-actions">
              <InvoiceDownloadButton orderNumber={number} />
              <OrderTrackingButton courier={view.courier} tracking={view.tracking} hasResi={view.hasResi} />
            </div>
          </section>

          <section className="panel resolution-panel" aria-labelledby="resolution-title">
            <div className="order-section-heading compact resolution-heading">
              <div>
                <h2 id="resolution-title"><AlertCircle size={16} aria-hidden="true" /> {hasResolution ? "Pusat resolusi" : "Ada masalah?"}</h2>
              </div>
            </div>

            {hasResolution && (
              <div className="resolution-stack">
                {cancellationMeta && (
                  <article className={`resolution-case resolution-case-${cancellationMeta.tone}`}>
                    <div className="resolution-case-head">
                      <div className="resolution-case-title-row">
                        <span className="resolution-case-label">Pembatalan pesanan</span>
                        <StatusBadge label={cancellationMeta.label} tone={cancellationMeta.tone} />
                      </div>
                      <p>{cancellationMeta.description}</p>
                    </div>
                    <OrderInfoTable
                      label="Rincian pembatalan"
                      rows={[
                        ...(cancellationRequestReason && !view.isSellerCancelled ? [{ label: "Alasan pengajuan", value: cancellationRequestReason }] : []),
                        ...(cancellationDecisionReason ? [{ label: view.isSellerCancelled ? "Alasan penjual" : "Alasan keputusan", value: cancellationDecisionReason }] : []),
                        ...(["refund_pending", "refunded", "partially_refunded"].includes(view.paymentState)
                          ? [{ label: "Status refund", value: <StatusPill status={view.paymentState} /> }]
                          : view.cancellationState === "approved" && view.paymentState === "paid"
                            ? [{ label: "Status refund", value: <StatusBadge label="Menunggu proses refund" tone="warning" /> }]
                            : []),
                      ]}
                    />
                  </article>
                )}

                {view.returnObj && returnMeta && (
                  <article className={`resolution-case resolution-case-${returnMeta.tone}`}>
                    <div className="resolution-case-head">
                      <div className="resolution-case-title-row">
                        <span className="resolution-case-label">Pengajuan masalah</span>
                        <StatusBadge label={returnMeta.label} tone={returnMeta.tone} />
                      </div>
                      <p>{returnMeta.description}</p>
                    </div>

                    <OrderInfoTable
                      label="Ringkasan pengajuan masalah"
                      rows={[
                        { label: "Solusi diminta", value: view.returnObj.reason === "refund" ? "Pengembalian dana" : humanizeMachineValue(view.returnObj.reason) },
                        ...(returnCause ? [{ label: "Jenis masalah", value: returnCause }] : []),
                        { label: "Deskripsi masalah", value: view.returnObj.description },
                        ...(returnDecisionReason ? [{ label: ["rejected", "cancelled", "inspection_failed"].includes(view.returnObj.state) ? "Alasan penolakan" : "Catatan keputusan", value: returnDecisionReason }] : []),
                        ...(view.returnObj.refundAmount > 0 && !view.returnObj.refund ? [{ label: "Nominal disetujui", value: rupiah(view.returnObj.refundAmount), className: "tabular-data" }] : []),
                        ...(view.returnObj.source === "issue" ? [{ label: "Sumber kasus", value: "Kendala terdeteksi oleh toko" }] : []),
                      ]}
                    />

                    {view.returnObj.items.length > 0 && (
                      <div className="resolution-subsection">
                        <h3>Produk terdampak</h3>
                        <div className="resolution-items-wrap">
                          <table className="resolution-items-table" aria-label="Produk yang diajukan dalam resolusi">
                            <thead>
                              <tr><th scope="col">Produk</th><th scope="col">Jumlah</th><th scope="col">Nilai</th></tr>
                            </thead>
                            <tbody>
                              {view.returnObj.items.map((item) => (
                                <tr key={item.id}>
                                  <td data-label="Produk">
                                    <div className="order-product-cell">
                                      {item.image && (
                                        <div className="order-product-thumb">
                                          <Image
                                            src={item.image}
                                            alt={item.name}
                                            fill
                                            sizes="40px"
                                            className="order-product-img"
                                            unoptimized
                                          />
                                        </div>
                                      )}
                                      <div className="order-product-meta">
                                        <strong>{item.name}</strong>
                                        <span>{item.options || item.sku}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="numeric-cell" data-label="Jumlah">{item.quantity}</td>
                                  <td className="numeric-cell" data-label="Nilai">{rupiah(item.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {view.returnObj.evidence.length > 0 && (
                      <div className="resolution-subsection">
                        <h3>Bukti pengajuan <span>{view.returnObj.evidence.length} foto</span></h3>
                        <div className="resolution-evidence-grid">
                          {view.returnObj.evidence.map((src, index) => (
                            <a href={src} className="resolution-evidence" key={src} aria-label={`Buka bukti pengajuan ${index + 1}`}>
                              <Image fill sizes="(max-width: 640px) 40vw, 140px" src={src} alt={`Bukti pengajuan masalah ${index + 1}`} unoptimized />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {view.returnObj.refund && (
                      <div className="resolution-subsection refund-detail-section">
                        <div className="refund-detail-heading">
                          <h3><CheckCircle2 size={15} aria-hidden="true" /> Dana refund terkirim</h3>
                          <StatusBadge label="Selesai" tone="success" />
                        </div>
                        <OrderInfoTable
                          label="Detail dana refund"
                          rows={[
                            { label: "Nominal refund", value: rupiah(view.returnObj.refund.amount), className: "tabular-data" },
                            ...(view.returnObj.refund.method ? [{ label: "Metode transfer", value: humanizeMachineValue(view.returnObj.refund.method) }] : []),
                            ...(view.returnObj.refund.reference ? [{ label: "Referensi", value: view.returnObj.refund.reference, className: "break-all tabular-data" }] : []),
                            ...(view.returnObj.refund.processedAt ? [{ label: "Tanggal transfer", value: view.returnObj.refund.processedAt }] : []),
                          ]}
                        />
                        {view.returnObj.refund.proofObjectKey && (
                          <div className="refund-proof-wrap">
                            <span>Bukti transfer</span>
                            <a href={view.returnObj.refund.proofObjectKey} className="refund-proof">
                              <Image fill sizes="220px" src={view.returnObj.refund.proofObjectKey} alt="Bukti transfer refund" unoptimized />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )}

                {view.issueOrder && !view.returnObj && !cancellationMeta && (
                  <article className="resolution-case resolution-case-danger">
                    <div className="resolution-case-head">
                      <div className="resolution-case-title-row">
                        <span className="resolution-case-label">Peninjauan toko</span>
                        <StatusBadge label="Dalam investigasi" tone="danger" />
                      </div>
                      <p>Tim toko sedang menyelesaikan kendala pemrosesan atau pengiriman pada pesanan ini.</p>
                    </div>
                  </article>
                )}

                {!view.issueOrder && !view.returnObj && !cancellationMeta && ["cancel_requested", "return_requested", "return_in_transit", "returned"].includes(view.displayStatus) && (
                  <article className="resolution-case resolution-case-info">
                    <div className="resolution-case-head">
                      <div className="resolution-case-title-row">
                        <span className="resolution-case-label">Status resolusi</span>
                        <StatusPill status={view.displayStatus} />
                      </div>
                      <p>Proses penyelesaian pesanan sedang berjalan. Perkembangan terbaru akan tercatat pada perjalanan paket.</p>
                    </div>
                  </article>
                )}

                {view.returnObj && ["awaiting_approval", "refund_pending", "processing_refund"].includes(view.returnObj.state) && view.userId && !view.hasRefundInfo && (
                  <div className="inline-alert inline-alert-danger">
                    <strong>Informasi rekening belum lengkap</strong>
                    <span>Lengkapi rekening atau e-wallet agar pengembalian dana dapat diproses. <Link href="/user/settings#payment">Lengkapi data rekening</Link></span>
                  </div>
                )}

                {view.canReturn && view.returnObj?.state === "rejected" && (
                  <Link className="button button-light button-block resolution-action" href={`/orders/${number}/return`}><RotateCcw size={15} aria-hidden="true" /> Ajukan masalah lagi</Link>
                )}
              </div>
            )}

            {!hasResolution && view.paymentState !== "expired" && ((view.canReturn && !view.returnState && !view.returnObj) || view.canCancel) && (
              <div className="resolution-support resolution-primary-action">
                <div>
                  <strong>Ada masalah yang dialami?</strong>
                  <span>
                    {view.status === "completed" && !view.isPast7Days
                      ? "Ajukan peninjauan masalah maksimal 7 hari setelah paket diterima."
                      : "Ajukan peninjauan masalah."}
                  </span>
                </div>

                <div className="resolution-actions-wrapper">
                  {view.canReturn && !view.returnState && !view.returnObj && (
                    <Link className="button button-light button-block resolution-action" href={`/orders/${number}/return`}>
                      <AlertCircle size={15} aria-hidden="true" /> Ajukan masalah
                    </Link>
                  )}
                  {view.canCancel && (
                    <OrderCancelButton number={number} paymentState={view.paymentState} turnstileSiteKey={turnstileSiteKey()} />
                  )}
                </div>
              </div>
            )}

              <div className="resolution-support">
                <div>
                  <strong>Butuh bantuan langsung?</strong>
                  <span>Sertakan nomor pesanan saat menghubungi tim kami.</span>
                </div>
                <a href="https://wa.me/628562524627" target="_blank" rel="noopener noreferrer" className="button button-dark button-block">
                  Chat Customer Service
                </a>
              </div>
            </section>
          </div>

          <aside className="order-detail-rail" aria-label="Ringkasan pesanan">
            <section className="panel order-package-panel" aria-labelledby="package-title">
              <div className="order-section-heading compact">
                <div>
                  <h2 id="package-title"><PackageOpen size={16} aria-hidden="true" /> Isi paket</h2>
                  <span className="order-section-kicker">{view.items.length} jenis produk</span>
                </div>
              </div>
              <div className="order-items-table-wrap">
                <table className="order-items-table" aria-label="Daftar isi paket">
                  <thead>
                    <tr>
                      <th scope="col">Produk</th>
                      <th scope="col">Jumlah</th>
                      <th scope="col">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.items.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Produk">
                          <div className="order-product-cell">
                            {item.image && (
                              <div className="order-product-thumb">
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  sizes="48px"
                                  className="order-product-img"
                                  unoptimized
                                />
                              </div>
                            )}
                            <div className="order-product-meta">
                              <strong>{item.name}</strong>
                              <span>{item.options || "Tanpa varian"} · {rupiah(item.unitPrice)} / item</span>
                            </div>
                          </div>
                        </td>
                        <td className="numeric-cell" data-label="Jumlah">{item.quantity}</td>
                        <td className="numeric-cell" data-label="Subtotal"><strong>{rupiah(item.lineTotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={2}>Pengiriman ({view.courier})</th>
                      <td className="numeric-cell">{rupiah(view.shipping)}</td>
                    </tr>
                    {view.discountAmount > 0 && (
                      <tr>
                        <th scope="row" colSpan={2}>Diskon promo ({view.voucherCode || "PROMO"})</th>
                        <td className="numeric-cell tone-success">-{rupiah(view.discountAmount)}</td>
                      </tr>
                    )}
                    {view.serviceFee > 0 && (
                      <tr>
                        <th scope="row" colSpan={2}>Biaya Layanan</th>
                        <td className="numeric-cell">{rupiah(view.serviceFee)}</td>
                      </tr>
                    )}
                    {view.uniqueCode > 0 && (
                      <tr>
                        <th scope="row" colSpan={2}>Nomor Acak Unik</th>
                        <td className="numeric-cell">{rupiah(view.uniqueCode)}</td>
                      </tr>
                    )}
                    <tr className="order-grand-total">
                      <th scope="row" colSpan={2}>Total pembayaran</th>
                      <td className="numeric-cell">{rupiah(view.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="panel panel-spaced order-address-panel" aria-labelledby="address-title">
              <div className="order-section-heading compact">
                <div>
                  <h2 id="address-title"><MapPin size={16} aria-hidden="true" /> Dikirim ke</h2>
                  <span className="order-section-kicker">Alamat pengiriman</span>
                </div>
              </div>
              <OrderInfoTable
                label="Informasi penerima"
                rows={[
                  { label: "Nama penerima", value: view.recipient },
                  { label: "Nomor telepon", value: view.phone, className: "tabular-data" },
                  { label: "Alamat lengkap", value: view.address, className: "multiline-value" },
                ]}
              />
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
