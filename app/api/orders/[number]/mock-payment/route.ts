import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { releaseOrderReservation } from "@/lib/inventory";
import { sha256 } from "@/lib/security";
import { customerFromRequest } from "@/lib/customer-auth";

const schema=z.object({token:z.string().optional(),result:z.enum(["paid","failed"])});

export async function POST(request:Request,{params}:{params:Promise<{number:string}>}){
  if(process.env.PAYMENT_MOCK!=="true")return NextResponse.json({error:"Mock payment tidak aktif"},{status:404});
  const body=schema.safeParse(await request.json());if(!body.success)return NextResponse.json({error:"Payload tidak valid"},{status:400});
  const {number}=await params;

  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order=await prisma.order.findUnique({where:{publicNumber:number},include:{payments:{where:{provider:"mock"},orderBy:{createdAt:"desc"},take:1}}});
  if(!order) return NextResponse.json({error:"Pesanan tidak ditemukan"},{status:404});

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if(!isOwner) return NextResponse.json({error:"Unauthorized"},{status:401});
  const payment=order.payments[0];if(!payment)return NextResponse.json({error:"Payment mock tidak ditemukan"},{status:404});
  if(payment.status!=="pending")return NextResponse.json({success:true,status:payment.status});
  await prisma.$transaction(async tx=>{
    if(body.data.result==="paid"){
      await tx.payment.update({where:{id:payment.id},data:{status:"paid",paidAt:new Date(),raw:{mock:true,result:"paid"}}});
      await tx.order.update({where:{id:order.id},data:{paymentState:"paid",fulfillmentState:"awaiting_processing"}});
    }else{
      await tx.payment.update({where:{id:payment.id},data:{status:"failed",raw:{mock:true,result:"failed"}}});
      await tx.order.update({where:{id:order.id},data:{paymentState:"failed",fulfillmentState:"cancelled"}});
      await releaseOrderReservation(tx,order.id,"mock_payment_failed");
    }
    await tx.auditLog.create({data:{actorType:"system",action:`payment.mock_${body.data.result}`,entityType:"order",entityId:order.id}});
  });
  return NextResponse.json({success:true,status:body.data.result});
}
