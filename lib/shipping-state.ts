export const handedOverBiteshipStatuses = new Set(["picked", "in_transit", "dropping_off", "delivered", "return_in_transit", "returned"]);
export const cancelledBiteshipStatuses = new Set(["cancelled", "rejected", "courier_not_found", "disposed"]);

export function fulfillmentFromBiteshipStatus(status: string) {
  if (["confirmed", "scheduled", "allocated"].includes(status)) return "shipment_booked" as const;
  if (status === "picking_up") return "handover_pending" as const;
  if (["picked", "in_transit", "dropping_off"].includes(status)) return "handed_over" as const;
  if (status === "delivered") return "completed" as const;
  if (status === "return_in_transit") return "return_in_transit" as const;
  if (status === "returned") return "returned" as const;
  if (cancelledBiteshipStatuses.has(status)) return "cancelled" as const;
  return undefined;
}

export type BiteshipStatusDetail = {
  category: string;
  label: string;
  meaning: string;
};

export const biteshipStatusDetails: Record<string, BiteshipStatusDetail> = {
  confirmed: {
    category: "Persiapan",
    label: "Pengiriman Dikonfirmasi",
    meaning: "Pesanan memasuki proses pengiriman.",
  },
  scheduled: {
    category: "Persiapan",
    label: "Pengiriman dijadwalkan",
    meaning: "Order dijadwalkan untuk diproses pada waktu tertentu",
  },
  allocated: {
    category: "Penjemputan",
    label: "Kurir dialokasikan",
    meaning: "Kurir telah ditentukan dan akan menjemput paket",
  },
  picking_up: {
    category: "Penjemputan",
    label: "Kurir menuju lokasi pickup",
    meaning: "Kurir sedang perjalanan mengambil paket",
  },
  picked: {
    category: "Penjemputan selesai",
    label: "Paket telah dijemput",
    meaning: "Paket sudah diambil oleh kurir",
  },
  in_transit: {
    category: "Perjalanan",
    label: "Paket dalam perjalanan",
    meaning: "Paket sedang dalam proses pengiriman ke alamat tujuan",
  },
  dropping_off: {
    category: "Pengantaran akhir",
    label: "Paket sedang diantar",
    meaning: "Paket sedang diantar ke alamat tujuan",
  },
  on_hold: {
    category: "Kendala sementara",
    label: "Pengiriman ditahan",
    meaning: "Paket sedang ditahan karena suatu kendala",
  },
  delivered: {
    category: "Selesai",
    label: "Paket telah diterima",
    meaning: "Paket berhasil diserahkan kepada penerima",
  },
  return_in_transit: {
    category: "Retur",
    label: "Paket sedang dikembalikan",
    meaning: "Paket dalam perjalanan kembali ke pengirim",
  },
  returned: {
    category: "Retur selesai",
    label: "Paket telah dikembalikan",
    meaning: "Paket sudah sampai kembali ke pengirim",
  },
  rejected: {
    category: "Gagal",
    label: "Pengiriman ditolak",
    meaning: "Order atau shipment ditolak",
  },
  courier_not_found: {
    category: "Gagal alokasi",
    label: "Kurir tidak tersedia",
    meaning: "Sistem tidak berhasil memperoleh kurir",
  },
  cancelled: {
    category: "Dibatalkan",
    label: "Pesanan dibatalkan",
    meaning: "Order telah dibatalkan",
  },
  disposed: {
    category: "Terminasi",
    label: "Paket dimusnahkan",
    meaning: "Paket telah dibuang atau dimusnahkan",
  },
  "order.price": {
    category: "Biaya",
    label: "Perubahan Ongkir",
    meaning: "Biaya pengiriman disesuaikan oleh kurir",
  },
  "order_price": {
    category: "Biaya",
    label: "Perubahan Ongkir",
    meaning: "Biaya pengiriman disesuaikan oleh kurir",
  },
  "order.waybill_id": {
    category: "Resi",
    label: "Perubahan Resi",
    meaning: "Nomor resi pengiriman telah diterbitkan/diperbarui",
  },
  "order_waybill_id": {
    category: "Resi",
    label: "Perubahan Resi",
    meaning: "Nomor resi pengiriman telah diterbitkan/diperbarui",
  },
};

export function getBiteshipStatusDetail(status?: string | null): BiteshipStatusDetail {
  if (!status) {
    return {
      category: "Persiapan",
      label: "Menunggu",
      meaning: "Menunggu diproses",
    };
  }
  const aliases: Record<string, string> = {
    pickingup: "picking_up",
    intransit: "in_transit",
    droppingoff: "dropping_off",
    returnintransit: "return_in_transit",
    onhold: "on_hold",
    couriernotfound: "courier_not_found",
    "order.price": "order.price",
    orderprice: "order.price",
    "order.waybill_id": "order.waybill_id",
    orderwaybillid: "order.waybill_id",
  };
  const compact = status.replace(/[_\s-]/g, "").toLowerCase();
  const normalized = aliases[compact] || status.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();

  return (
    biteshipStatusDetails[normalized] || {
      category: "Lainnya",
      label: status,
      meaning: `Status ${status}`,
    }
  );
}
