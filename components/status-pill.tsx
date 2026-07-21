import type { OrderStatus } from "@/lib/types";

const labels = {
  awaiting_payment: "Menunggu",
  awaiting_processing: "Antrean",
  processing: "Diproses",
  packed: "Dikemas",
  shipment_booked: "Dipesan",
  handover_pending: "Penjemputan",
  handed_over: "Diserahkan",
  in_transit: "Dikirim",
  delivered: "Terkirim",
  completed: "Selesai",
  cancel_requested: "Pembatalan",
  cancelled: "Dibatalkan",
  return_requested: "Retur",
  return_in_transit: "Transit",
  returned: "Diretur",
  finished: "Selesai",
  not_created: "Draf",
  paid: "Lunas",
  pending: "Menunggu",
  expired: "Kedaluwarsa",
  canceled: "Dibatalkan",
  failed: "Gagal",
  denied: "Ditolak",
  refund_pending: "Refund",
  refunded: "Direfund",
  partially_refunded: "Parsial",
  requested: "Diajukan",
  under_review: "Ditinjau",
  rejected: "Ditolak",
  approved: "Disetujui",
  awaiting_handover: "Penjemputan",
  received: "Diterima",
  inspection_passed: "Lolos",
  inspection_failed: "Gagal",
  closed: "Ditutup",
  awaiting_approval: "Persetujuan",
  waiting_waybill: "Resi",
  processing_return: "Memproses",
  return_complete: "Selesai",
  processing_refund: "Refund",
  provider_pending: "Penyedia",
  provider_failed: "Kendala",
} as const satisfies Record<string, string>;

export type StatusKey = keyof typeof labels;
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
