import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReturnForm } from "@/components/return-form";
import { StoreHeader } from "@/components/store-header";
import { customerFromRequest } from "@/lib/customer-auth";

export default async function ReturnPage({params}:{params:Promise<{number:string}>}) {
  const {number}=await params;
  const customer = await customerFromRequest();
  if (!customer) {
    redirect(`/login?redirect=/orders/${number}/return`);
  }
  const {prisma}=await import("@/lib/db");
  const order=await prisma.order.findUnique({where:{publicNumber:number},include:{items:true}});
  if(!order || order.fulfillmentState!=="completed") notFound();
  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) notFound();
  const orderItems = order.items.map(item => ({
    id: item.id,
    sku: item.skuSnapshot,
    name: item.nameSnapshot,
    options: Object.values(item.optionsSnapshot as Record<string, string>).filter(Boolean).join(" · "),
    price: Number(item.unitPrice),
    quantity: item.quantity,
  }));
  return (
    <>
      <StoreHeader />
      <main className="simple-page return-request-page">
        <div className="page-title">
          <Link href={`/orders/${number}`} className="eyebrow"><ArrowLeft size={13} /> Pesanan {number}</Link>
          <h1>Ajukan masalah</h1>
          <p>Semua proses peninjauan, pengiriman balik, tracking, dan status refund tersedia di aplikasi.</p>
        </div>
        <ReturnForm number={number} orderItems={orderItems} />
      </main>
    </>
  );
}
