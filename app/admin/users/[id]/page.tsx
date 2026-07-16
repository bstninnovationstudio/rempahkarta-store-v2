import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CreditCard, MapPin, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import type { OrderStatus } from "@/lib/types";

function uiStatus(value: string): OrderStatus {
  if (["packed", "shipment_booked"].includes(value)) return "processing";
  if (["handed_over", "return_in_transit"].includes(value)) return "in_transit";
  if (value === "returned") return "completed";
  return (["awaiting_payment", "awaiting_processing", "processing", "handover_pending", "completed", "cancelled", "finished"].includes(value) ? value : "awaiting_processing") as OrderStatus;
}

export default async function UserDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: { id: "desc" } },
      refundSetting: true,
      orders: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) {
    notFound();
  }

  const totalSpent = user.orders
    .filter(o => o.paymentState === "paid" || o.fulfillmentState === "completed")
    .reduce((sum, o) => sum + Number(o.grandTotal), 0);

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <Link href="/admin/users" className="eyebrow">
            <ArrowLeft size={13} /> Kembali ke daftar pelanggan
          </Link>
          <h1>Detail Pelanggan</h1>
          <p>Kelola dan tinjau profil, alamat tersimpan, serta riwayat belanja.</p>
        </div>
      </div>

      <div className="user-detail-layout">
        <div>
          {/* Profile Card */}
          <div className="detail-card">
            <h3>
              <User size={16} /> Profil Pelanggan
            </h3>
            <div className="admin-customer-profile">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="admin-customer-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="admin-customer-avatar fallback">
                  {user.name[0]?.toUpperCase()}
                </span>
              )}
              <div>
                <h2>{user.name}</h2>
                <span>ID: {user.id}</span>
              </div>
            </div>

            <div className="profile-row">
              <span>Alamat Email</span>
              <strong>{user.email}</strong>
            </div>
            <div className="profile-row">
              <span>Google Sub ID</span>
              <strong>{user.googleId}</strong>
            </div>
            <div className="profile-row">
              <span>Nomor WhatsApp</span>
              <strong>{user.phone || "Belum diisi"}</strong>
            </div>
            <div className="profile-row">
              <span>Tanggal Mendaftar</span>
              <strong>{new Date(user.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</strong>
            </div>
            <div className="profile-row">
              <span>Total Pesanan</span>
              <strong>{user.orders.length} Pesanan</strong>
            </div>
            <div className="profile-row">
              <span>Total Belanja (Berhasil)</span>
              <strong>{rupiah(totalSpent)}</strong>
            </div>
          </div>

          {/* Refund settings card */}
          <div className="detail-card">
            <h3>
              <CreditCard size={16} /> Pengaturan Rekening Refund
            </h3>
            {user.refundSetting ? (
              user.refundSetting.type === "bank" ? (
                <>
                  <div className="profile-row">
                    <span>Jenis</span>
                    <strong>Transfer Bank</strong>
                  </div>
                  <div className="profile-row">
                    <span>Nama Bank</span>
                    <strong>{user.refundSetting.bankName}</strong>
                  </div>
                  <div className="profile-row">
                    <span>Atas Nama Pemilik</span>
                    <strong>{user.refundSetting.bankOwnerName}</strong>
                  </div>
                  <div className="profile-row">
                    <span>Nomor Rekening</span>
                    <strong>{user.refundSetting.bankNumber}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="profile-row">
                    <span>Jenis</span>
                    <strong>E-Wallet</strong>
                  </div>
                  <div className="profile-row">
                    <span>Penyedia Layanan</span>
                    <strong>{user.refundSetting.ewalletName}</strong>
                  </div>
                  <div className="profile-row">
                    <span>Nama Akun</span>
                    <strong>{user.refundSetting.ewalletOwnerName}</strong>
                  </div>
                  <div className="profile-row">
                    <span>Nomor Telepon</span>
                    <strong>{user.refundSetting.ewalletNumber}</strong>
                  </div>
                </>
              )
            ) : (
              <p className="detail-empty">Pelanggan belum mengatur rekening bank atau e-wallet refund.</p>
            )}
          </div>

          {/* Address card */}
          <div className="detail-card">
            <h3>
              <MapPin size={16} /> Buku Alamat Tersimpan ({user.addresses.length}/5)
            </h3>
            {user.addresses.length > 0 ? (
              user.addresses.map(addr => (
                <div key={addr.id} className="admin-address-item">
                  <div className="admin-address-item-head">
                    <strong>{addr.label}</strong>
                    <span>Kode Pos: {addr.postalCode}</span>
                  </div>
                  <p>{addr.address}</p>
                  <span>Penerima: {addr.contactName} ({addr.contactPhone}) · {addr.contactEmail}</span>
                </div>
              ))
            ) : (
              <p className="detail-empty">Belum ada alamat pengiriman terdaftar.</p>
            )}
          </div>
        </div>

        <div>
          {/* Order history sidebar card */}
          <div className="detail-card order-history-card">
            <h3>
              <ClipboardList size={16} /> Riwayat Pesanan ({user.orders.length})
            </h3>
            {user.orders.length > 0 ? (
              <div className="admin-order-history">
                {user.orders.map(order => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.publicNumber}`}
                    className="admin-order-history-item"
                  >
                    <div className="admin-order-history-head">
                      <strong>{order.publicNumber}</strong>
                      <StatusPill status={uiStatus(order.fulfillmentState)} />
                    </div>
                    <div className="admin-order-history-meta">
                      <span>{new Date(order.createdAt).toLocaleDateString("id-ID")}</span>
                      <strong>{rupiah(Number(order.grandTotal))}</strong>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="detail-empty">Belum ada pesanan terdaftar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
