import { notFound, redirect } from "next/navigation";
import { MockPaymentActions } from "@/components/mock-payment-actions";
import { prisma } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { customerFromRequest } from "@/lib/customer-auth";
import { isPaymentMock } from "@/lib/env";

export default async function MockPaymentPage({ params }: { params: Promise<{ number: string }> }) {
  if (!isPaymentMock()) notFound();
  const { number } = await params;
  const customer = await customerFromRequest();
  if (!customer) {
    redirect(`/login?redirect=/orders/${number}/mock-payment`);
  }
  const order = await prisma.order.findUnique({ where: { publicNumber: number }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!order) notFound();
  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if(!isOwner) notFound();
  return (
    <main className="simple-page mock-payment-page">
      <section className="panel mock-payment-card">
        <p className="eyebrow">Mode uji pembayaran</p>
        <h1>Simulasi BSTN</h1>
        <p>Halaman ini hanya aktif saat <code>PAYMENT_MOCK=true</code>. Pilih hasil untuk menguji perpindahan status, reservasi stok, dan panel admin.</p>
        <div className="detail-list mock-payment-detail">
          <div><span>Pesanan</span><strong>{number}</strong></div>
          <div><span>Total</span><strong>{rupiah(Number(order.grandTotal))}</strong></div>
          <div><span>Status</span><strong>{order.paymentState}</strong></div>
        </div>
        {order.paymentState === "pending"
          ? <MockPaymentActions number={number} />
          : <p className="form-banner">Pembayaran mock sudah berstatus <strong>{order.paymentState}</strong>.</p>}
      </section>
    </main>
  );
}
