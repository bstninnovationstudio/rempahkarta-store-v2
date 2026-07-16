import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { customerFromRequest } from "@/lib/customer-auth";

const schema=z.object({
  token:z.string().optional(),
  reason:z.string().min(2),
  cause:z.string().min(2).optional(),
  description:z.string().min(10),
  items:z.array(z.object({orderItemId:z.string(),quantity:z.number().int().positive()})).min(1),
  evidence:z.array(z.string()).max(5).default([]),
});

export async function POST(request:Request,{params}:{params:Promise<{number:string}>}){
  const body=schema.safeParse(await request.json());
  if(!body.success)return NextResponse.json({error:"Payload tidak valid"},{status:400});
  const {number}=await params;

  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order=await prisma.order.findUnique({
    where:{publicNumber:number},
    include:{
      items:true,
      returns:{where:{state:{notIn:["rejected","closed"]}}},
      shipments:{include:{events:{where:{providerStatus:"delivered"},orderBy:{occurredAt:"desc"},take:1}},take:1},
    },
  });
  if(!order) return NextResponse.json({error:"Pesanan tidak ditemukan"},{status:404});

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if(!isOwner) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(order.fulfillmentState!=="completed")return NextResponse.json({error:"Retur baru dapat diajukan setelah paket diterima"},{status:409});
  if(order.returns.length)return NextResponse.json({error:"Masih ada pengajuan aktif"},{status:409});

  const deliveredAt=order.shipments[0]?.events[0]?.occurredAt;
  if(deliveredAt&&Date.now()-deliveredAt.getTime()>7*24*60*60*1000)return NextResponse.json({error:"Masa pengajuan retur 7 hari telah berakhir"},{status:409});
  let calculatedRefundAmount = 0;
  for(const requested of body.data.items){
    const item=order.items.find(candidate=>candidate.id===requested.orderItemId);
    if(!item||requested.quantity>item.quantity)return NextResponse.json({error:"Item retur tidak sesuai dengan pesanan"},{status:400});
    calculatedRefundAmount += Number(item.unitPrice) * requested.quantity;
  }

  const returnCase=await prisma.$transaction(async tx=>{
    const created=await tx.returnRequest.create({
      data:{
        orderId:order.id,
        publicNumber:`RET-${Date.now().toString(36).toUpperCase()}`,
        reason:body.data.reason,
        cause:body.data.cause || null,
        description:body.data.description,
        evidence:body.data.evidence,
        refundAmount:BigInt(calculatedRefundAmount),
        items:{create:body.data.items}
      }
    });
    await tx.order.update({where:{id:order.id},data:{fulfillmentState:"return_requested"}});
    await tx.auditLog.create({data:{actorType:"guest",action:"return.requested",entityType:"return",entityId:created.id,after:{reason:body.data.reason,cause:body.data.cause,itemCount:body.data.items.length}}});
    return created;
  });
  return NextResponse.json({success:true,return_number:returnCase.publicNumber},{status:201});
}
