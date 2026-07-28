import { getBiteshipStatusDetail } from "@/lib/shipping-state";
import { getWebhookBaseUrl } from "@/lib/env";
import { WHATSAPP_AUTOMATED_FOOTER } from "@/lib/gowa";

function humanizeMachineValue(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function getCustomerShipmentStatusDetail(status?: string | null) {
  const detail = getBiteshipStatusDetail(status);
  if (detail.category !== "Lainnya") return detail;
  const label = humanizeMachineValue(status || "");
  return {
    category: "Pembaruan",
    label,
    meaning: `Kurir memperbarui status pengiriman: ${label.toLowerCase()}.`,
  };
}

export function cleanCustomerShipmentNote(
  note: string | null | undefined,
  rawStatus: string,
  fallback: string,
) {
  if (
    !note
    || note.trim() === rawStatus
    || note.trim() === `Status ${rawStatus}`
    || /^[\[{]/.test(note.trim())
  ) return fallback;
  return note
    .replace(/Booking Biteship dikonfirmasi/gi, "Pesanan memasuki proses pengiriman")
    .replace(/Sinkronisasi manual Biteship/gi, "Pembaruan status pengiriman")
    .replace(/Biteship/gi, "kurir")
    .replace(/courier_not_found/gi, "kurir tidak tersedia")
    .replace(/return_in_transit/gi, "dalam perjalanan kembali")
    .replace(/dropping_off/gi, "sedang diantar")
    .replace(/picking_up/gi, "menuju lokasi penjemputan")
    .replace(/on_hold/gi, "pengiriman ditahan");
}

export function formatCustomerShipmentEvent(input: {
  providerStatus: string;
  note?: string | null;
  payload?: unknown;
  courierCompany?: string | null;
  courierType?: string | null;
}) {
  const detail = getCustomerShipmentStatusDetail(input.providerStatus);
  const courier = [input.courierCompany?.toUpperCase(), input.courierType]
    .filter(Boolean)
    .join(" ");
  let note = cleanCustomerShipmentNote(
    input.note,
    input.providerStatus,
    detail.meaning || courier || "Status pengiriman diperbarui.",
  );
  const payload = input.payload && typeof input.payload === "object"
    ? input.payload as Record<string, unknown>
    : null;

  if (input.providerStatus === "order.price") {
    const newPrice = payload?.price ?? payload?.order_price;
    if (newPrice != null && Number.isFinite(Number(newPrice))) {
      note = `Biaya pengiriman disesuaikan menjadi Rp ${Number(newPrice).toLocaleString("id-ID")}`;
    }
  } else if (input.providerStatus === "order.waybill_id") {
    const waybill = payload?.courier_waybill_id ?? payload?.waybill_id ?? payload?.courier_tracking_id;
    if (waybill) note = `Nomor resi pengiriman diterbitkan: ${String(waybill)}`;
  }

  return { title: detail.label, note };
}

export function formatWhatsappTimelineMessage(input: {
  occurredAt: Date;
  title: string;
  note: string;
  publicNumber?: string | null;
}) {
  const timestamp = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  })
    .format(input.occurredAt)
    .replace(/\./g, ":")
    .replace(",", "");

  const appUrl = (getWebhookBaseUrl() || "https://rempahkarta.com").replace(/\/+$/, "");
  const trackingUrl = input.publicNumber ? `${appUrl}/orders/${input.publicNumber}` : null;

  const parts = [
    `\`[${timestamp}]\``,
    "",
    "*UPDATE PESANAN:*",
    `\`${input.publicNumber || "-"}\``,
    "",
    `*${input.title.toUpperCase()}*`,
    input.note,
  ];

  if (trackingUrl) {
    parts.push("", "*LACAK PESANAN:*", trackingUrl);
  }

  parts.push("", WHATSAPP_AUTOMATED_FOOTER);

  return parts.join("\n");
}
