import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, Download, MapPin, Truck } from "lucide-react";
import { StatusPill, type StatusKey } from "@/components/status-pill";
import { StoreHeader } from "@/components/store-header";
import { OrderCancelButton } from "@/components/order-cancel-button";
import { products } from "@/lib/demo-data";
import { isDemo } from "@/lib/env";
import { rupiah } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { getBiteshipStatusDetail } from "@/lib/shipping-state";
import { customerFromRequest } from "@/lib/customer-auth";

const demoEvents = [
  { at: "13 Jul\n14.32", title: "Paket dalam perjalanan ke kota tujuan", note: "JNE Jakarta Gateway" },
  { at: "13 Jul\n12.08", title: "Paket telah diambil kurir", note: "Gudang AMK, Jakarta Selatan" },
  { at: "13 Jul\n10.17", title: "Pesanan selesai dikemas", note: "Menunggu pickup JNE Regular" },
  { at: "13 Jul\n09.44", title: "Pembayaran QRIS berhasil", note: "Pesanan diteruskan ke tim fulfillment" },
];

function maskEmail(value: string) {
  const [name, domain = ""] = value.split("@");
  return `${name.slice(0, 2)}••@${domain}`;
}
function maskPhone(value: string) { return `${value.slice(0, 4)}••••${value.slice(-3)}`; }
function maskName(value: string) { return `${value.split(" ")[0]} ${value.split(" ").slice(1).map(() => "S••••").join(" ")}`.trim(); }

type AuditLogView = { action: string; after: unknown; createdAt: Date };

function hasFulfillmentState(value: unknown, state: string) {
  return typeof value === "object"
    && value !== null
    && "fulfillmentState" in value
    && (value as { fulfillmentState?: unknown }).fulfillmentState === state;
}

function getPaymentLabel(state: string): string {
  switch (state) {
    case "pending": return "Menunggu Pembayaran";
    case "paid": return "Lunas";
    case "not_created": return "Belum dibuat";
    case "canceled": return "Dibatalkan";
    case "expired": return "Kadaluwarsa";
    case "failed": return "Gagal";
    case "denied": return "Ditolak";
    case "refund_pending": return "Refund Diproses";
    case "refunded": return "Refund Selesai";
    case "partially_refunded": return "Refund Sebagian";
    default: return state;
  }
}

function getPaymentBadgeStyle(state: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    display: "inline-block"
  };
  switch (state) {
    case "paid":
    case "refunded":
      return { ...base, background: "rgba(40, 115, 78, 0.08)", color: "var(--success)" };
    case "pending":
    case "refund_pending":
    case "partially_refunded":
      return { ...base, background: "rgba(167, 107, 23, 0.08)", color: "var(--warning)" };
    case "canceled":
    case "expired":
    case "failed":
    case "denied":
      return { ...base, background: "rgba(181, 67, 59, 0.08)", color: "var(--danger)" };
    default:
      return { ...base, background: "var(--surface-muted)", color: "var(--ink-muted)" };
  }
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
  let view = {
    created: "13 Juli 2026, 09.42 WIB",
    email: "bu••@email.com",
    status: "in_transit" as OrderStatus,
    displayStatus: "in_transit" as StatusKey,
    events: demoEvents,
    itemName: product.name,
    itemOptions: "Regular · 100 g · 1 item",
    itemPrice: product.price,
    shipping: 19000,
    total: product.price + 19000,
    courier: "JNE Regular",
    tracking: "AMK128732198",
    recipient: "Budi S••••••",
    address: "Jl. Senopati No. ••, Kebayoran Baru\nJakarta Selatan, 12110",
    phone: "0812••••7890",
    canReturn: true,
    canCancel: false,
    isPast7Days: false,
    hasRefundInfo: false,
    userId: null as string | null,
    paymentState: "paid",
    paymentUrl: null as string | null,
    returnState: null as string | null,
    cancellationState: null as string | null,
    cancellationReason: null as string | null,
    cancellationDecisionReason: null as string | null,
    isSellerCancelled: false,
    issueOrder: false,
    returnObj: null as {
      id: string;
      state: string;
      reason: string;
      description: string;
      decisionReason: string | null;
      refundAmount: number;
      source: string;
      cause: string | null;
      refund: {
        amount: number;
        method: string | null;
        reference: string | null;
        proofObjectKey: string | null;
        processedAt: string | null;
      } | null;
    } | null,
  };

  let auditLogs: AuditLogView[] = [];

  if (!isDemo()) {
    const customer = await customerFromRequest();
    if (!customer) {
      redirect(`/login?redirect=/orders/${number}`);
    }
    const { prisma } = await import("@/lib/db");
    const order = await prisma.order.findUnique({
      where: { publicNumber: number },
      include: {
        items: true,
        addresses: true,
        shipments: { include: { events: { orderBy: { occurredAt: "desc" } } }, take: 1 },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        returns: { include: { refunds: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } },
        cancellations: { orderBy: { requestedAt: "desc" } },
      },
    });
    if (!order) notFound();
    auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "order",
        entityId: order.id,
        action: { in: ["order.processing", "order.packed", "order.manual_status"] }
      },
      orderBy: { createdAt: "asc" }
    });
    const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
    if (!isOwner) notFound();
    const item = order.items[0];
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
    
    view = {
      created: new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(order.createdAt),
      email: maskEmail(order.guestEmail),
      status: uiStatus(order.fulfillmentState),
      displayStatus: order.fulfillmentState,
      events: (() => {
        const list: Array<{ time: Date; title: string; note: string }> = [];
        
        // 1. Add cancellation state events if any
        order.cancellations.forEach(cancel => {
          const isSeller = cancel.reason === "Dibatalkan langsung oleh admin" || cancel.reason === "Dibatalkan oleh penjual";
          
          if (cancel.state === "approved") {
            const isAutoApproved = cancel.decidedBy === "system" || cancel.reason.includes("Kadaluwarsa") || cancel.reason.includes("otomatis");
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: isSeller ? "Dibatalkan oleh Penjual" : "Pembatalan Disetujui",
              note: isSeller
                ? `Alasan penjual: ${cancel.decisionReason || "Kebijakan penjual."}`
                : isAutoApproved
                  ? "Pengajuan pembatalan telah disetujui otomatis."
                  : `Pengajuan pembatalan telah disetujui. Alasan penjual: ${cancel.decisionReason || "Proses refund sedang disiapkan."}`
            });
          } else if (cancel.state === "rejected") {
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: "Pengajuan Pembatalan Ditolak",
              note: `Ditolak oleh penjual. Alasan: ${cancel.decisionReason || "Pesanan tetap diproses."}`
            });
          } else if (cancel.state === "provider_failed") {
            list.push({
              time: cancel.decidedAt || cancel.requestedAt,
              title: "Pembatalan Bermasalah",
              note: "Gagal memproses pembatalan ke provider pengiriman. Menunggu tinjauan ulang admin."
            });
          } else if (cancel.state === "requested") {
            list.push({
              time: cancel.requestedAt,
              title: "Pembatalan Diajukan",
              note: `Alasan pembeli: ${cancel.reason}`
            });
          }
          
          // If the request was approved/rejected/provider_failed, also show when it was originally requested by the buyer
          if (cancel.state !== "requested" && !isSeller) {
            list.push({
              time: cancel.requestedAt,
              title: "Pembatalan Diajukan",
              note: `Alasan pembeli: ${cancel.reason}`
            });
          }
        });

        // 1.5. Add return/refund state events if any
        order.returns.forEach(ret => {
          if (ret.state === "awaiting_approval" || ret.state === "requested") {
            list.push({
              time: ret.updatedAt,
              title: "Proses Refund Didaftarkan",
              note: "Menunggu persetujuan Tim pengembalian dana."
            });
          } else if (["processing_refund", "refund_pending"].includes(ret.state)) {
            list.push({
              time: ret.updatedAt,
              title: "Proses Refund Disetujui",
              note: "Pengembalian dana sedang diproses."
            });
          } else if (["refunded", "finished", "closed"].includes(ret.state)) {
            list.push({
              time: ret.updatedAt,
              title: "Proses Refund Selesai",
              note: "Pengembalian dana telah dikirimkan."
            });
          } else if (ret.state === "rejected" || ret.state === "cancelled") {
            list.push({
              time: ret.updatedAt,
              title: "Proses Refund Tidak Disetuji",
              note: `Pengembalian dana tidak diproses. Alasan: ${ret.decisionReason || "Tidak memenuhi kriteria kebijakan."}`
            });
          }

          // Always show the original request creation
          list.push({
            time: ret.createdAt,
            title: "Refund Diajukan",
            note: `Alasan: ${ret.cause === "damaged" ? "Produk rusak/cacat" : ret.cause === "wrong" ? "Produk tidak sesuai" : "Pesanan tidak lengkap"}. Deskripsi: ${ret.description}`
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
        }
        
        // 3. Add Biteship shipment tracking events (most recent first)
        if (shipment?.events.length) {
          const statusEvents = shipment.events.filter(event => {
            const detail = getBiteshipStatusDetail(event.providerStatus);
            return detail.category !== "Lainnya";
          });
          list.push(...statusEvents.map((event) => {
            const detail = getBiteshipStatusDetail(event.providerStatus);
            let note = event.note || detail.meaning || `${shipment.courierCompany.toUpperCase()} ${shipment.courierType}`;
            
            if (event.providerStatus === "order.price") {
              const payloadObj = event.payload as Record<string, unknown> | null;
              const newPrice = payloadObj?.price ?? payloadObj?.order_price;
              if (newPrice != null) {
                note = `Biaya pengiriman disesuaikan menjadi Rp ${Number(newPrice).toLocaleString("id-ID")}`;
              }
            } else if (event.providerStatus === "order.waybill_id") {
              const payloadObj = event.payload as Record<string, unknown> | null;
              const resi = payloadObj?.courier_waybill_id ?? payloadObj?.waybill_id ?? payloadObj?.courier_tracking_id;
              if (resi) {
                note = `Nomor resi pengiriman diterbitkan: ${resi}`;
              }
            }

            if (note.includes("Biteship")) {
              note = note.replace(/Booking Biteship dikonfirmasi/gi, "Pesanan memasuki proses pengiriman.")
                         .replace(/Sinkronisasi manual Biteship/gi, "Pembaruan status pengiriman.")
                         .replace(/Biteship/g, "kurir");
            }

            return {
              time: event.occurredAt,
              title: detail.label,
              note
            };
          }));
        } else if (shipment) {
          const detail = getBiteshipStatusDetail(shipment.status);
          list.push({
            time: shipment.createdAt,
            title: detail.label === "Pesanan dikonfirmasi" ? "Pengiriman dikonfirmasi" : (detail.label || "Pengiriman di-booking"),
            note: `Pengiriman dikonfirmasi · ${shipment.courierCompany.toUpperCase()} ${shipment.courierType}`
          });
        }

        // 4. Add fulfillment state events (processing / packed)
        const actualState = order.fulfillmentState === "cancelled" || order.fulfillmentState === "cancel_requested"
          ? (order.cancellations[0]?.fulfillmentBefore || "awaiting_processing")
          : order.fulfillmentState;

        const wasProcessed = ["processing", "packed", "shipment_booked", "handed_over", "in_transit", "completed", "return_requested", "return_in_transit", "returned"].includes(actualState);
        const wasPacked = ["packed", "shipment_booked", "handed_over", "in_transit", "completed", "return_requested", "return_in_transit", "returned"].includes(actualState);

        const paidTime = order.payments[0]?.paidAt || order.createdAt;

        // Extract real timestamps from AuditLogs if available
        const processingLog = auditLogs.find(l => 
          l.action === "order.processing" || 
          (l.action === "order.manual_status" && hasFulfillmentState(l.after, "processing"))
        );
        const packedLog = auditLogs.find(l => 
          l.action === "order.packed" || 
          (l.action === "order.manual_status" && hasFulfillmentState(l.after, "packed"))
        );

        if (wasProcessed) {
          const processedTime = processingLog?.createdAt || new Date(paidTime.getTime() + 1000);
          if (wasPacked) {
            // Deduct 1 second from shipment creation time if it exists, to ensure packing event is older than booking event
            const packedTime = packedLog?.createdAt || (shipment ? new Date(shipment.createdAt.getTime() - 1000) : new Date(processedTime.getTime() + 1000));
            list.push({
              time: packedTime,
              title: "Pesanan sudah dikemas",
              note: "Paket telah selesai dikemas dan siap dikirim."
            });
          }
          list.push({
            time: processedTime,
            title: "Pesanan sedang diproses",
            note: "Pesanan dikonfirmasi dan sedang disiapkan oleh penjual."
          });
        }

        // 5. Payment / created entry at the bottom
        list.push({
          time: order.createdAt,
          title: order.paymentState === "paid" ? "Pembayaran QRIS berhasil" : "Menunggu pembayaran QRIS",
          note: order.paymentState === "paid" ? "Pesanan diteruskan ke tim fulfillment." : "Status akan diperbarui otomatis."
        });
        
        // Sort chronologically descending
        list.sort((a, b) => b.time.getTime() - a.time.getTime());

        return list.map(event => {
          const d = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(event.time);
          const t = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(event.time).replace(/\./g, ":");
          return {
            at: `${d}\n${t}`,
            title: event.title,
            note: event.note
          };
        });
      })(),
      itemName: item?.nameSnapshot || "Produk AMK",
      itemOptions: `${Object.values((item?.optionsSnapshot || {}) as Record<string, string>).filter(Boolean).join(" · ")} · ${item?.quantity || 1} item`,
      itemPrice: Number(item?.unitPrice || order.subtotal),
      shipping: Number(order.shippingFee),
      total: Number(order.grandTotal),
      courier: shipment ? `${shipment.courierCompany.toUpperCase()} ${shipment.courierType}` : "Belum dibooking",
      tracking: shipment?.waybillId || shipment?.trackingId || "Menunggu resi",
      recipient: address ? maskName(address.contactName) : maskName(order.guestName),
      address: address ? `${address.address.replace(/\d+/g, "••")}\n${address.postalCode}` : "Alamat tersimpan",
      phone: maskPhone(address?.contactPhone || order.guestPhone),
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

  return (
    <>
      <StoreHeader />
      <main className="simple-page">
        <Link href="/" className="eyebrow"><ArrowLeft size={13} /> Kembali ke toko</Link>
        <div className="order-hero">
          <div>
            <p className="eyebrow">Pesanan Anda</p>
            <h1>{number}</h1>
            <p className="order-meta">
              <span>Dibuat <strong>{view.created}</strong></span>
              <span className="order-meta-divider">·</span>
              <span className="order-payment-state">
                Status Pembayaran:
                <span style={getPaymentBadgeStyle(view.paymentState)}>
                  {getPaymentLabel(view.paymentState)}
                </span>
              </span>
            </p>
          </div>
          <StatusPill status={view.displayStatus} />
        </div>
        {view.issueOrder && (
          <section className="panel notice-card notice-danger">
            <strong>Pesanan dalam proses peninjauan</strong>
            <p>
              Kami mendeteksi kendala pada pengiriman atau pemrosesan pesanan Anda. Tim toko kami sedang menyelesaikan masalah ini. Status akan diperbarui secara otomatis setelah diselesaikan. Terima kasih atas kesabaran Anda.
            </p>
          </section>
        )}
        {view.paymentUrl && (
          <section className="panel notice-card payment-notice">
            <strong>Pembayaran belum selesai.</strong>
            <p>Lanjutkan melalui halaman pembayaran yang sudah dibuat agar referensi pesanan tetap sama.</p>
            <a className="button button-dark" href={view.paymentUrl}>Lanjutkan pembayaran</a>
          </section>
        )}
        <div className="order-layout">
          <section className="panel">
            <h2>Perjalanan paket</h2>
            
            {(() => {
              const is4BarProgress = view.issueOrder || 
                (view.cancellationState && view.cancellationState !== "rejected") || 
                view.returnObj || 
                (view.status === "cancelled" && view.isSellerCancelled) || 
                ["refund_pending", "refunded"].includes(view.paymentState);

              const active4BarStep = (() => {
                if (view.returnObj) {
                  if (view.returnObj.state === "rejected") {
                    return "ditolak";
                  }
                  if (["refunded", "closed", "finished"].includes(view.returnObj.state)) {
                    return "selesai";
                  }
                  if (["processing_refund", "refund_pending", "awaiting_approval", "requested", "under_review", "approved", "awaiting_handover", "in_transit", "received", "inspection_passed", "inspection_failed", "processing_return", "return_complete"].includes(view.returnObj.state)) {
                    return "retur_refund";
                  }
                }
                if (view.paymentState === "refunded") return "selesai";
                if (view.paymentState === "refund_pending") return "retur_refund";
                return "investigasi";
              })();

              if (is4BarProgress) {
                const firstStepLabel = (view.returnObj || ["refund_pending", "refunded"].includes(view.paymentState)) ? "Refund Diajukan" : "Pembatalan Diajukan";
                const lastStepLabel = (view.returnObj?.state === "rejected") ? "Ditolak" : "Selesai";

                return (
                  <div className="tracking-progress issue-progress steps-4">
                    <div className="tracking-step done">{firstStepLabel}</div>
                    <div className={`tracking-step ${active4BarStep === "investigasi" ? "active" : "done"}`}>Investigasi</div>
                    <div className={`tracking-step ${active4BarStep === "retur_refund" ? "active" : (["selesai", "ditolak"].includes(active4BarStep) ? "done" : "")}`}>Refund Dana</div>
                    <div className={`tracking-step ${["selesai", "ditolak"].includes(active4BarStep) ? "active" : ""}`}>{lastStepLabel}</div>
                  </div>
                );
              }

              return null;
            })() || (view.paymentState === "expired" ? (
              <div className="tracking-progress steps-1 no-line">
                <div className="tracking-step done tone-danger">
                  Kadaluwarsa
                </div>
              </div>
            ) : view.cancellationState === "requested" ? (
              <div className="tracking-progress steps-2">
                <div className="tracking-step done">Pesanan diproses</div>
                <div className="tracking-step done tone-warning">
                  Pembatalan Diajukan
                </div>
              </div>
            ) : view.cancellationState === "approved" || view.status === "cancelled" || view.paymentState === "canceled" ? (
              view.paymentState === "paid" || view.paymentState === "refund_pending" || view.paymentState === "refunded" ? (
                <div className="tracking-progress steps-2">
                  <div className="tracking-step done">{view.isSellerCancelled ? "Dibatalkan oleh Penjual" : "Pembatalan disetujui"}</div>
                  <div className="tracking-step done tone-info">
                    Proses Refund
                  </div>
                </div>
              ) : (
                <div className="tracking-progress steps-1 no-line">
                  <div className="tracking-step done tone-danger">
                    {view.isSellerCancelled ? "Dibatalkan oleh Penjual" : "Pesanan Dibatalkan"}
                  </div>
                </div>
              )
            ) : (
              <div className="tracking-progress">
                <div className="tracking-step done">Pesanan diproses</div>
                <div className={`tracking-step ${["in_transit", "completed"].includes(view.status) ? "done" : ""}`}>Diambil kurir</div>
                <div className={`tracking-step ${["in_transit", "completed"].includes(view.status) ? "done" : ""}`}>Dalam perjalanan</div>
                <div className={`tracking-step ${view.status === "completed" ? "done" : ""}`}>Terkirim</div>
              </div>
            ))}

            <div className="timeline">
              {view.events.map((event, index) => (
                <div className="timeline-item" key={`${event.at}-${index}`}>
                  <div className="timeline-time">{event.at.split("\n").map(part => <span key={part}>{part}<br /></span>)}</div>
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <strong>{event.title}</strong>
                    <p>{event.note}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="order-actions">
              <button className="button button-light"><Download size={15} /> Unduh invoice</button>
              <a className="button button-light" href="#tracking"><Truck size={15} /> {view.courier} · {view.tracking}</a>
            </div>
          </section>
          <aside>
            <section className="panel">
              <h2>Isi paket</h2>
              <div className="order-item-mini">
                <div className="order-item-mini-image"><Image unoptimized src={product.image} alt={view.itemName} fill /></div>
                <div>
                  <h3>{view.itemName}</h3>
                  <p>{view.itemOptions}</p>
                  <strong>{rupiah(view.itemPrice)}</strong>
                </div>
              </div>
              <div className="detail-list">
                <div><span>Pengiriman</span><strong>{view.courier} · {rupiah(view.shipping)}</strong></div>
                <div><span>Total</span><strong>{rupiah(view.total)}</strong></div>
              </div>
            </section>
            <section className="panel panel-spaced">
              <h2><MapPin size={15} /> Dikirim ke</h2>
              <p className="address-copy">{view.recipient}<br />{view.address}<br />{view.phone}</p>
            </section>
            <section className="panel panel-spaced resolution-panel">
              {(view.issueOrder || (view.cancellationState && view.cancellationState !== "rejected") || view.returnObj || view.status === "cancelled") ? (
                <>
                  <h2><AlertCircle size={15} /> Pusat Resolusi</h2>
                  
                  {/* Case 1: Pembatalan Diajukan */}
                  {view.cancellationState === "requested" && (
                    <div className="resolution-summary">
                      <p className="resolution-title">
                        Status pembatalan: Diajukan
                      </p>
                      <p className="resolution-emphasis tone-danger">
                        Pesanan sedang diinvestigasi.
                      </p>
                    </div>
                  )}

                  {/* Case 2: Pengajuan Pembatalan Ditolak */}
                  {view.cancellationState === "rejected" && (
                    <div className="resolution-summary">
                      <p className="resolution-title">
                        Status pembatalan: Ditolak
                      </p>
                      {view.cancellationDecisionReason && (
                        <p className="resolution-note tone-danger">
                          <strong>Alasan Penolakan:</strong> {view.cancellationDecisionReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Case 3: Pembatalan Disetujui */}
                  {view.cancellationState === "approved" && !view.isSellerCancelled && (
                    <div className="resolution-summary">
                      <p className="resolution-title">
                        Status pembatalan: Disetujui
                      </p>
                      <p className="resolution-emphasis tone-danger">
                        Refund sedang di proses.
                      </p>
                    </div>
                  )}

                  {/* Case 4: Dibatalkan oleh Penjual */}
                  {view.status === "cancelled" && view.isSellerCancelled && (
                    <div className="resolution-summary">
                      {view.cancellationDecisionReason && (
                        <p className="resolution-note">
                          <strong>Alasan Penjual:</strong> {view.cancellationDecisionReason}
                        </p>
                      )}
                      <p className="resolution-emphasis tone-danger">
                        Refund sedang di proses.
                      </p>
                    </div>
                  )}

                  {/* Case 5 & 6 & 7: Refund Didaftarkan / Disetujui / Selesai */}
                  {view.returnObj && (
                    (() => {
                      const returnStateLabels: Record<string, string> = {
                        requested: "Menunggu Peninjauan",
                        under_review: "Sedang Ditinjau",
                        approved: "Pengajuan Disetujui",
                        awaiting_handover: "Menunggu Pengembalian Barang",
                        in_transit: "Dalam Perjalanan Kembali",
                        received: "Barang Diterima Penjual",
                        inspection_passed: "Lolos Inspeksi",
                        inspection_failed: "Gagal Inspeksi",
                        refund_pending: "Menunggu Transfer Refund",
                        processing_refund: "Proses Transfer Refund",
                        refunded: "Refund Selesai",
                        closed: "Ditutup",
                        awaiting_approval: "Menunggu Persetujuan Resolusi",
                        waiting_waybill: "Menunggu Input Resi Pengembalian",
                        processing_return: "Barang Pengembalian Diproses",
                        return_complete: "Barang Tiba di Penjual",
                        cancelled: "Resolusi Ditolak",
                        finished: "Resolusi Selesai",
                        rejected: "Ditolak"
                      };
                      return (
                        <div className="resolution-card">
                          <div>
                            <span>Status resolusi: </span>
                            <strong className={view.returnObj.state === "rejected" ? "tone-danger" : "tone-warning"}>
                              {returnStateLabels[view.returnObj.state] || view.returnObj.state}
                            </strong>
                          </div>
                          <div>
                            <span>Tipe Resolusi: </span>
                            <strong className="text-capitalize">
                              {view.returnObj.source === "issue" ? "Resolusi Pesanan Bermasalah (Refund Dana)" : "Pengajuan Refund Pelanggan"}
                            </strong>
                          </div>
                          {view.returnObj.state === "rejected" && view.returnObj.decisionReason && (
                            <div className="resolution-note resolution-note-danger">
                              <strong>Alasan Penolakan:</strong> {view.returnObj.decisionReason}
                            </div>
                          )}
                          {view.returnObj.cause && (
                            <div>
                              <span>Penyebab: </span>
                              <strong className="text-capitalize">{view.returnObj.cause.replace(/_/g, " ")}</strong>
                            </div>
                          )}
                          {view.returnObj.description && (
                            <div className="resolution-note resolution-note-muted">
                              {view.returnObj.description}
                            </div>
                          )}
                          
                          {/* Refund details if finished or refunded */}
                          {view.returnObj.refund && (
                            <div className="refund-detail-card">
                              <strong className="refund-detail-title">Detail dana refund terkirim</strong>
                              <div>
                                <span>Nominal Refund:</span>
                                <strong>{rupiah(view.returnObj.refund.amount)}</strong>
                              </div>
                              <div>
                                <span>Metode Transfer:</span>
                                <strong>Manual Transfer</strong>
                              </div>
                              <div>
                                <span>Referensi:</span>
                                <strong className="break-all">{view.returnObj.refund.reference}</strong>
                              </div>
                              <div>
                                <span>Tanggal:</span>
                                <strong>{view.returnObj.refund.processedAt}</strong>
                              </div>
                              {view.returnObj.refund.proofObjectKey && (
                                <div className="refund-proof-wrap">
                                  <span>Lampiran bukti transfer</span>
                                  <a href={view.returnObj.refund.proofObjectKey} target="_blank" rel="noopener noreferrer" className="refund-proof">
                                    <Image fill src={view.returnObj.refund.proofObjectKey} alt="Bukti transfer refund" unoptimized />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* Warning banner: Rekening pengisian warning */}
                  {view.returnObj && view.returnObj.state === "awaiting_approval" && view.userId && !view.hasRefundInfo && (
                    <div className="inline-alert inline-alert-danger">
                      <strong>Informasi rekening belum lengkap</strong>
                      <span>Mohon lengkapi data rekening atau e-wallet untuk pengembalian dana agar refund dapat segera diproses. <Link href="/user/settings#payment">Isi data rekening →</Link></span>
                    </div>
                  )}

                  {/* General investigasi text if issueOrder is true and there is no returnObj or cancellation state */}
                  {view.issueOrder && !view.returnObj && view.cancellationState !== "requested" && (
                    <p className="resolution-emphasis tone-danger">
                      Pesanan sedang diinvestigasi.
                    </p>
                  )}

                  {view.canReturn && view.returnObj?.state === "rejected" && (
                    <Link className="button button-light button-block resolution-action" href={`/orders/${number}/return`}>Ajukan masalah lagi</Link>
                  )}
                </>
              ) : (
                <>
                  <h2><AlertCircle size={15} /> Ada masalah?</h2>
                  
                  {view.status === "completed" && view.isPast7Days && (
                    <p className="resolution-note tone-danger">
                      Waktu klaim sudah melewati batas yang ditentukan (maksimal 7 hari setelah paket diterima).
                    </p>
                  )}
                  
                  {view.status === "completed" && !view.isPast7Days && (
                    <p className="resolution-note">
                      Ajukan masalah atau retur maksimal 7 hari setelah paket diterima.
                    </p>
                  )}

                  {view.canReturn && !view.returnState && !view.returnObj && (
                    <Link className="button button-light button-block resolution-action" href={`/orders/${number}/return`}>Ajukan masalah</Link>
                  )}
                  {view.canCancel && (
                    <div className="resolution-action">
                      <OrderCancelButton number={number} paymentState={view.paymentState} />
                    </div>
                  )}
                </>
              )}

              <a
                href="https://wa.me/628562524627"
                target="_blank"
                rel="noopener noreferrer"
                className="button button-whatsapp button-block"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.714-1.466L0 24zm6.59-4.846c1.6.95 3.16 1.455 4.71 1.456 5.48 0 9.94-4.455 9.94-9.94a9.78 9.78 0 0 0-2.87-6.96A9.78 9.78 0 0 0 11.5 1.09c-5.48 0-9.94 4.455-9.94 9.94.002 1.66.452 3.28 1.3 4.74l-.99 3.61 3.7-.97z" />
                </svg>
                Chat Customer Service
              </a>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
