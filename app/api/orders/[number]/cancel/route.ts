import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { releaseOrderReservation } from "@/lib/inventory";
import { BstnPaymentAdapter } from "@/lib/adapters/bstn";
import { verifyTurnstile } from "@/lib/turnstile";
import { customerFromRequest } from "@/lib/customer-auth";


const schema = z.object({ token: z.string().optional(), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const body = schema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  const { number } = await params;

  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { publicNumber: number }, include: { payments: true, shipments: true, cancellations:true } });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (order.fulfillmentState === "cancelled") return NextResponse.json({ success: true, status: "cancelled" });
  if (["handed_over", "completed", "return_in_transit", "returned"].includes(order.fulfillmentState)) return NextResponse.json({ error: "Paket sudah diserahkan; gunakan alur retur" }, { status: 409 });
  const payment=order.payments.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0];
  if (order.paymentState === "pending") {
    if (payment?.providerPaymentId && payment.provider !== "mock") {
      if(!process.env.BSTN_PROJECT_API_KEY||!process.env.BSTN_RETURN_SIGNATURE_SECRET)return NextResponse.json({error:"Konfigurasi BSTN belum lengkap"},{status:503});
      const bstn = new BstnPaymentAdapter(process.env.BSTN_BASE_URL || "https://www.bstn-innovation-studio.web.id", process.env.BSTN_PROJECT_API_KEY, process.env.BSTN_RETURN_SIGNATURE_SECRET);
      try { await bstn.cancelPayment(payment.providerPaymentId, body.data.reason); }
      catch { return NextResponse.json({ error: "Pembatalan pembayaran ke BSTN gagal. Status pesanan belum diubah; silakan coba kembali." }, { status: 502 }); }
    }
    await prisma.$transaction(async (tx) => {
      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "canceled" } });
      }
      await tx.order.update({ where: { id: order.id }, data: { paymentState: "canceled", fulfillmentState: "cancelled" } });
      await tx.cancellationRequest.create({ data: { orderId: order.id, reason: body.data.reason, state: "approved", fulfillmentBefore: order.fulfillmentState, decidedAt: new Date(), decidedBy: "system" } });
      await releaseOrderReservation(tx, order.id, "customer_cancelled_pending_payment");
    });
    return NextResponse.json({ success: true, status: "cancelled" });
  }
  if(order.cancellations.some(item=>item.state==="requested"))return NextResponse.json({success:true,status:"cancel_requested"});
  await prisma.$transaction([
    prisma.cancellationRequest.create({ data: { orderId: order.id, reason: body.data.reason, fulfillmentBefore: order.fulfillmentState } }),
    prisma.order.update({ where: { id: order.id }, data: { fulfillmentState: "cancel_requested" } }),
  ]);
  return NextResponse.json({ success: true, status: "cancel_requested" });
}
