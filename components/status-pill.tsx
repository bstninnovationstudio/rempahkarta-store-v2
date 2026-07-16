import type { OrderStatus } from "@/lib/types";

const labels: Record<OrderStatus | "paid" | "pending" | "refund_pending", string> = {
  awaiting_payment: "Menunggu bayar",
  awaiting_processing: "Perlu diproses",
  processing: "Sedang diproses",
  handover_pending: "Menunggu pickup",
  in_transit: "Dalam pengiriman",
  delivered: "Terkirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  finished: "Selesai",
  paid: "Lunas",
  pending: "Pending",
  refund_pending: "Refund pending",
};

export function StatusPill({ status }: { status: keyof typeof labels }) {
  return <span className={`status-pill status-${status}`}>{labels[status]}</span>;
}
