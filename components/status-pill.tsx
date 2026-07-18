import type { OrderStatus } from "@/lib/types";

const labels = {
  awaiting_payment: "Menunggu pembayaran",
  awaiting_processing: "Perlu diproses",
  processing: "Sedang diproses",
  packed: "Sudah dikemas",
  shipment_booked: "Pengiriman dipesan",
  handover_pending: "Menunggu penjemputan",
  handed_over: "Diserahkan ke kurir",
  in_transit: "Dalam pengiriman",
  delivered: "Terkirim",
  completed: "Selesai",
  cancel_requested: "Pembatalan diajukan",
  cancelled: "Dibatalkan",
  return_requested: "Retur diajukan",
  return_in_transit: "Retur dalam pengiriman",
  returned: "Retur diterima",
  finished: "Selesai",
  not_created: "Belum dibuat",
  paid: "Lunas",
  pending: "Menunggu",
  expired: "Kedaluwarsa",
  canceled: "Dibatalkan",
  failed: "Gagal",
  denied: "Ditolak",
  refund_pending: "Menunggu refund",
  refunded: "Sudah direfund",
  partially_refunded: "Refund sebagian",
  requested: "Diajukan",
  under_review: "Sedang ditinjau",
  rejected: "Ditolak",
  approved: "Disetujui",
  awaiting_handover: "Menunggu serah terima",
  received: "Barang diterima",
  inspection_passed: "Pemeriksaan lolos",
  inspection_failed: "Pemeriksaan gagal",
  closed: "Ditutup",
  awaiting_approval: "Menunggu persetujuan",
  waiting_waybill: "Menunggu resi",
  processing_return: "Memproses retur",
  return_complete: "Retur selesai",
  processing_refund: "Memproses refund",
  provider_pending: "Menunggu penyedia",
  provider_failed: "Penyedia gagal memproses",
} as const satisfies Record<string, string>;

type StatusKey = keyof typeof labels;
type SupportedStatus = OrderStatus | StatusKey;

const successStatuses = new Set<SupportedStatus>([
  "paid", "delivered", "completed", "finished", "refunded", "returned", "approved", "received", "inspection_passed", "closed", "return_complete",
]);
const processStatuses = new Set<SupportedStatus>([
  "processing", "packed", "shipment_booked", "handed_over", "in_transit", "under_review", "awaiting_handover", "return_in_transit", "processing_return", "processing_refund",
]);
const dangerStatuses = new Set<SupportedStatus>([
  "cancelled", "canceled", "expired", "failed", "denied", "rejected", "inspection_failed", "provider_failed",
]);

function statusTone(status: SupportedStatus) {
  if (successStatuses.has(status)) return "success";
  if (processStatuses.has(status)) return "info";
  if (dangerStatuses.has(status)) return "danger";
  return "warning";
}

export function StatusPill({ status }: { status: StatusKey }) {
  const label = labels[status];
  const tone = statusTone(status);
  return <span className={`status-pill status-${status} status-tone-${tone}`} aria-label={`Status: ${label}`}>{label}</span>;
}
