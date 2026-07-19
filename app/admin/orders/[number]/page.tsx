import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Printer, Truck } from "lucide-react";
import { AdminOrderActions } from "@/components/admin-order-actions";
import { StatusPill } from "@/components/status-pill";
import { AdminOrderStatusMock } from "@/components/admin-order-status-mock";
import { getAdminOrderDetail } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";
import { getBiteshipStatusDetail } from "@/lib/shipping-state";
import type { OrderStatus } from "@/lib/types";
import { isDevToolsEnabled } from "@/lib/env";

function uiStatus(value: string): OrderStatus {
  if (["packed", "shipment_booked"].includes(value)) return "processing";
  if (["handed_over", "return_in_transit"].includes(value)) return "in_transit";
  if (value === "returned") return "completed";
  return (["awaiting_payment", "awaiting_processing", "processing", "handover_pending", "completed", "cancelled", "finished"].includes(value)
    ? value
    : "awaiting_processing") as OrderStatus;
}

function paymentUiStatus(value: string): "paid" | "pending" | "refund_pending" {
  if (value === "paid") return "paid";
  if (value === "refund_pending") return "refund_pending";
  return "pending";
}

export default async function AdminOrderDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await getAdminOrderDetail(number);
  if (!order) notFound();

  const shipmentDetail = order.shipment ? getBiteshipStatusDetail(order.shipment.status) : null;

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <Link href="/admin/orders" className="eyebrow admin-back"><ArrowLeft size={13} aria-hidden="true" /> Semua pesanan</Link>
          <h1 className="admin-data-code admin-title-code">{order.number}</h1>
          <p>{order.createdAt} · {order.customer}</p>
        </div>
        <StatusPill status={uiStatus(order.fulfillmentState)} />
      </div>

      {order.issueOrder && (
        <div className="admin-issue-banner" role="status">
          <strong>Pesanan bermasalah, butuh resolusi</strong>
          <p>Aktivitas terakhir mengalami kendala: <b>{order.issueReason || "Tidak ditentukan"}</b>. Pilih refund atau tandai selesai dari panel aksi.</p>
        </div>
      )}

      {order.cancellation?.state === "requested" && (
        <div className="admin-issue-banner warning" role="status">
          <strong>Pengajuan pembatalan pelanggan</strong>
          <p><b>Alasan pelanggan:</b> {order.cancellation.reason}</p>
        </div>
      )}

      <div className="admin-detail-grid">
        <div>
          <section className="admin-section" aria-labelledby="order-items-title">
            <h2 id="order-items-title">Item pesanan</h2>
            <div className="admin-order-items">
              {order.items.map(item => (
                <div className="order-item-mini" key={item.id}>
                  <div className="order-item-mini-image"><Image unoptimized src={item.image} alt={item.name} fill /></div>
                  <div className="admin-list-copy">
                    <p className="eyebrow admin-data-code">{item.sku}</p>
                    <h3>{item.name}</h3>
                    <p>{item.options ? `${item.options} · ` : ""}{item.quantity} item</p>
                    <strong className="admin-numeric">{rupiah(item.price)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-section" aria-labelledby="order-activity-title">
            <h2 id="order-activity-title">Aktivitas pesanan</h2>
            {isDevToolsEnabled() && <AdminOrderStatusMock number={order.number} fulfillmentState={order.fulfillmentState} issueOrder={order.issueOrder} />}
            <div className="timeline admin-order-timeline" role="list" aria-label="Riwayat aktivitas pesanan">
              {order.events.map((event, index) => (
                <div className="timeline-item" role="listitem" key={`${event.at}-${index}`}>
                  <div className="timeline-time">{event.at}</div>
                  <div className="timeline-marker" />
                  <div className="timeline-content"><strong>{event.title}</strong><p>{event.note}</p></div>
                </div>
              ))}
            </div>
          </section>

          {order.shipment && shipmentDetail && (
            <section className="admin-section" aria-labelledby="order-shipment-title">
              <h2 id="order-shipment-title"><Truck size={15} aria-hidden="true" /> Pengiriman Biteship</h2>
              <div className="detail-list">
                <div><span>Kurir</span><strong>{order.shipment.courier}</strong></div>
                <div>
                  <span>Status provider</span>
                  <strong className="provider-status">{shipmentDetail.label} ({shipmentDetail.category})<small>{shipmentDetail.meaning}</small></strong>
                </div>
                <div>
                  <span>Resi aktif</span>
                  <strong className="admin-data-code">
                    {order.shipment.waybillId || "Menunggu resi"}{" "}
                    <Link href={`/admin/orders/${order.number}/resi`} target="_blank" rel="noopener noreferrer" className="admin-data-link" style={{ fontSize: "12px", marginLeft: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Printer size={13} aria-hidden="true" /> Cetak
                    </Link>
                  </strong>
                </div>
                <div><span>Ongkir checkout</span><strong className="admin-numeric">{rupiah(order.shipment.quotedPrice)}</strong></div>
                <div><span>Biaya aktual</span><strong className="admin-numeric">{rupiah(order.shipment.actualPrice)}</strong></div>
                <div><span>Selisih toko</span><strong className={`admin-numeric ${order.shipment.priceAdjustment ? "tone-danger" : ""}`}>{rupiah(order.shipment.priceAdjustment)}</strong></div>
              </div>
              {order.shipment.priceAdjustment !== 0 && <p className="summary-note">Selisih biaya pengiriman ditanggung toko dan tidak mengubah total yang sudah dibayar pelanggan.</p>}
            </section>
          )}
        </div>

        <aside>
          <section className="admin-section admin-action-rail">
            <h2>Aksi berikutnya</h2>
            <AdminOrderActions
              number={order.number}
              paymentState={order.paymentState}
              fulfillmentState={order.fulfillmentState}
              hasShipment={Boolean(order.shipment)}
              collectionMethods={order.collectionMethods}
              cancellationState={order.cancellation?.state}
              cancellationReason={order.cancellation?.reason}
              cancellationDecisionReason={order.cancellation?.decisionReason}
              issueOrder={Boolean(order.issueOrder)}
              issueReason={order.issueReason}
            />
          </section>

          <section className="admin-section">
            <h2><MapPin size={15} aria-hidden="true" /> Alamat pelanggan</h2>
            <p className="admin-customer-address">
              {order.customer} · {order.phone}
              {order.userId && <><br /><Link href={`/admin/users/${order.userId}`}>Pelanggan terdaftar</Link></>}
              <br />{order.email}<br />{order.address}<br /><em>{order.note}</em>
            </p>
          </section>

          <section className="admin-section">
            <h2>Ringkasan</h2>
            <div className="detail-list">
              <div><span>Subtotal</span><strong className="admin-numeric">{rupiah(order.subtotal)}</strong></div>
              <div><span>Pengiriman</span><strong className="admin-numeric">{rupiah(order.shippingFee)}</strong></div>
              <div><span>Total invoice</span><strong className="admin-numeric">{rupiah(order.grandTotal)}</strong></div>
              <div><span>QRIS dibayar</span><strong className="admin-numeric">{rupiah(order.payableAmount)}</strong></div>
              <div><span>Pembayaran</span><StatusPill status={paymentUiStatus(order.paymentState)} /></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
