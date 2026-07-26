import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CreditCard, MapPin, ClipboardList } from "lucide-react";
import { AdminPagination } from "@/components/admin-pagination";
import { prisma } from "@/lib/db";
import { customerPaymentTotal, getCustomerPaidTotal } from "@/lib/payment-totals";
import { rupiah } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import type { OrderStatus } from "@/lib/types";

import { AdminUserStatusControl } from "@/components/admin-user-status-control";

function uiStatus(value: string): OrderStatus {
  if (["packed", "shipment_booked"].includes(value)) return "processing";
  if (["handed_over", "return_in_transit"].includes(value)) return "in_transit";
  if (value === "returned") return "completed";
  return (["awaiting_payment", "awaiting_processing", "processing", "handover_pending", "completed", "cancelled", "finished"].includes(value) ? value : "awaiting_processing") as OrderStatus;
}

export default async function UserDetailAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requestedPage = Number.isSafeInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1;
  const pageSize = 10;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
      addresses: { orderBy: { id: "desc" } },
      refundSetting: true,
    },
  });

  if (!user) {
    notFound();
  }

  const [totalOrders, spent] = await Promise.all([
    prisma.order.count({ where: { userId: id } }),
    getCustomerPaidTotal(id),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const orders = await prisma.order.findMany({
    where: { userId: id },
    select: { id: true, publicNumber: true, fulfillmentState: true, createdAt: true, grandTotal: true, payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { payableAmount: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const totalSpent = Number(spent);
  const orderPagination = {
    page,
    pageSize,
    total: totalOrders,
    totalPages,
    from: totalOrders === 0 ? 0 : (page - 1) * pageSize + 1,
    to: totalOrders === 0 ? 0 : Math.min(page * pageSize, totalOrders),
  };

  return (
    <div className="admin-content admin-user-detail-page">
      <div className="admin-page-head">
        <div>
          <Link href="/admin/users" className="eyebrow admin-back">
            <ArrowLeft size={13} aria-hidden="true" /> Kembali ke daftar pelanggan
          </Link>
          <h1>{user.name}</h1>
          <p>Detail profil, alamat tersimpan, rekening pengembalian dana, dan riwayat belanja.</p>
        </div>
        <AdminUserStatusControl userId={user.id} initialStatus={user.status} />
      </div>

      <div className="user-detail-layout">
        {/* 1. Profile Card */}
        <div className="detail-card">
          <h2 className="detail-card-heading">
            <User size={16} aria-hidden="true" /> Profil pelanggan
          </h2>
          <div className="admin-customer-profile">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="admin-customer-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="admin-customer-avatar fallback">
                {user.name[0]?.toUpperCase()}
              </span>
            )}
            <div>
              <strong className="admin-customer-name">{user.name}</strong>
            </div>
          </div>

          <div className="profile-row">
            <span>ID pelanggan</span>
            <strong className="admin-data-code">{user.id}</strong>
          </div>
          <div className="profile-row">
            <span>Alamat email</span>
            <strong>{user.email}</strong>
          </div>
          <div className="profile-row">
            <span>Nomor WhatsApp</span>
            <strong>{user.phone || "Belum diisi"}</strong>
          </div>
          <div className="profile-row">
            <span>Terdaftar sejak</span>
            <strong>{new Date(user.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</strong>
          </div>
          <div className="profile-row">
            <span>Total pesanan</span>
            <strong className="admin-numeric">{totalOrders} pesanan</strong>
          </div>
          <div className="profile-row">
            <span>Total belanja berhasil</span>
            <strong className="admin-numeric">{rupiah(totalSpent)}</strong>
          </div>
        </div>



        {/* 2. Refund settings card */}
        <div className="detail-card">
          <h2 className="detail-card-heading">
            <CreditCard size={16} aria-hidden="true" /> Rekening pengembalian dana
          </h2>
          {user.refundSetting ? (
            user.refundSetting.type === "bank" ? (
              <>
                <div className="profile-row">
                  <span>Jenis</span>
                  <strong>Transfer Bank</strong>
                </div>
                <div className="profile-row">
                  <span>Nama bank</span>
                  <strong>{user.refundSetting.bankName}</strong>
                </div>
                <div className="profile-row">
                  <span>Atas nama</span>
                  <strong>{user.refundSetting.bankOwnerName}</strong>
                </div>
                <div className="profile-row">
                  <span>Nomor rekening</span>
                  <strong className="admin-data-code">{user.refundSetting.bankNumber}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="profile-row">
                  <span>Jenis</span>
                  <strong>E-Wallet</strong>
                </div>
                <div className="profile-row">
                  <span>Penyedia layanan</span>
                  <strong>{user.refundSetting.ewalletName}</strong>
                </div>
                <div className="profile-row">
                  <span>Nama akun</span>
                  <strong>{user.refundSetting.ewalletOwnerName}</strong>
                </div>
                <div className="profile-row">
                  <span>Nomor telepon</span>
                  <strong className="admin-data-code">{user.refundSetting.ewalletNumber}</strong>
                </div>
              </>
            )
          ) : (
            <p className="detail-empty">Pelanggan belum mengatur rekening bank atau e-wallet untuk pengembalian dana.</p>
          )}
        </div>

        {/* 3. Address card */}
        <div className="detail-card">
          <h2 className="detail-card-heading">
            <MapPin size={16} aria-hidden="true" /> Alamat pengiriman ({user.addresses.length}/5)
          </h2>
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
            <p className="detail-empty">Belum ada alamat pengiriman tersimpan.</p>
          )}
        </div>

        {/* 4. Order history card (Placed at the very bottom) */}
        <div className="detail-card order-history-card">
          <h2 className="detail-card-heading">
            <ClipboardList size={16} aria-hidden="true" /> Riwayat pesanan ({totalOrders})
          </h2>
          {orders.length > 0 ? (
            <div className="admin-order-history">
              {orders.map(order => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.publicNumber}`}
                  className="admin-order-history-item"
                >
                  <div className="admin-order-history-head">
                    <strong className="admin-data-code">{order.publicNumber}</strong>
                    <StatusPill status={uiStatus(order.fulfillmentState)} />
                  </div>
                  <div className="admin-order-history-meta">
                    <span>{new Date(order.createdAt).toLocaleDateString("id-ID")}</span>
                    <strong className="admin-numeric">{rupiah(Number(customerPaymentTotal(order.grandTotal, order.payments[0]?.payableAmount)))}</strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="detail-empty">Belum ada pesanan terdaftar.</p>
          )}
          <AdminPagination data={orderPagination} basePath={`/admin/users/${id}`} itemLabel="pesanan" />
        </div>
      </div>
    </div>
  );
}
