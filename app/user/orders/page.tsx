import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageOpen, ReceiptText } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkAndExpireAllStaleOrders } from "@/lib/payment-sync";
import { rupiah } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import { customerPaymentTotal } from "@/lib/payment-totals";

const PAGE_SIZE = 10;

export default async function UserOrdersHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const customer = await customerFromRequest();
  if (!customer) return null;

  await checkAndExpireAllStaleOrders();

  const query = await searchParams;
  const parsedPage = Number.parseInt(query.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const accountOrderWhere: Prisma.OrderWhereInput = {
    OR: [
      { userId: customer.id },
      { userId: null, guestEmail: customer.email },
    ],
  };

  const [totalOrders, orders] = await prisma.$transaction([
    prisma.order.count({ where: accountOrderWhere }),
    prisma.order.findMany({
      where: accountOrderWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        publicNumber: true,
        createdAt: true,
        grandTotal: true,
        payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { payableAmount: true } },
        paymentState: true,
        fulfillmentState: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  if (page > totalPages) redirect(`/user/orders?page=${totalPages}`);
  const firstItem = totalOrders === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalOrders);

  return (
    <div className="user-orders-page">
      <header className="user-page-hero orders-hero">
        <div>
          <span className="user-page-eyebrow">Riwayat transaksi</span>
          <h1>Pesanan Anda</h1>
          <p>Lihat status pembayaran, proses pengemasan, pengiriman, dan rincian setiap transaksi.</p>
        </div>
        <div className="orders-total-summary">
          <ReceiptText size={18} aria-hidden="true" />
          <div><strong>{totalOrders}</strong><span>total pesanan</span></div>
        </div>
      </header>

      {orders.length > 0 ? (
        <>
          <div className="orders-list-toolbar">
            <p>Menampilkan <strong>{firstItem}–{lastItem}</strong> dari {totalOrders} pesanan</p>
            <span>{PAGE_SIZE} pesanan per halaman</span>
          </div>
          <div className="orders-history-list">
            {orders.map((order) => {
              const date = new Intl.DateTimeFormat("id-ID", {
                dateStyle: "long",
              }).format(order.createdAt);
              return (
                <article key={order.id} className="order-card">
                  <Link href={`/orders/${order.publicNumber}`} className="order-card-main" aria-label={`Lihat rincian pesanan ${order.publicNumber}`}>
                    <span className="order-card-icon"><PackageOpen size={19} aria-hidden="true" /></span>
                    <div className="order-card-identity">
                      <span>Nomor pesanan</span>
                      <h2>{order.publicNumber}</h2>
                      <p>Dibuat {date}</p>
                    </div>
                    <div className="order-card-statuses" aria-label="Status pesanan">
                      <StatusPill status={order.paymentState} />
                      <StatusPill status={order.fulfillmentState} />
                    </div>
                    <div className="order-card-total">
                      <span>Total pembayaran</span>
                      <strong>{rupiah(Number(customerPaymentTotal(order.grandTotal, order.payments[0]?.payableAmount)))}</strong>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="user-pagination" aria-label="Halaman riwayat pesanan">
              {page > 1 ? (
                <Link href={`/user/orders?page=${page - 1}`} rel="prev">
                  <ChevronLeft size={15} aria-hidden="true" /> Sebelumnya
                </Link>
              ) : (
                <span aria-disabled="true"><ChevronLeft size={15} aria-hidden="true" /> Sebelumnya</span>
              )}
              <p>Halaman <strong>{page}</strong> dari {totalPages}</p>
              {page < totalPages ? (
                <Link href={`/user/orders?page=${page + 1}`} rel="next">
                  Berikutnya <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ) : (
                <span aria-disabled="true">Berikutnya <ChevronRight size={15} aria-hidden="true" /></span>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="account-empty-state user-orders-empty">
          <PackageOpen size={30} aria-hidden="true" />
          <strong>Belum ada pesanan</strong>
          <p>Setelah checkout selesai, pesanan pertama Anda akan tercatat di sini.</p>
          <Link href="/#product" className="button button-dark">Jelajahi produk</Link>
        </div>
      )}
    </div>
  );
}
