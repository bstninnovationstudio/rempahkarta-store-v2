import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

const schema=z.object({amount:z.number().int().positive(),method:z.string().min(2),reference:z.string().min(3),proofObjectKey:z.string().min(3)});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const admin=await adminFromRequest();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});const body=schema.safeParse(await request.json());if(!body.success)return NextResponse.json({error:"Bukti dan referensi refund wajib diisi"},{status:400});const {id}=await params;
  const ret=await prisma.returnRequest.findUnique({where:{id},include:{refunds:{where:{status:"completed"}},order:{include:{payments:{where:{status:"paid"},take:1}}}}});
  if(!ret||!ret.order.payments[0]||!["inspection_passed","refund_pending","processing_refund"].includes(ret.state))return NextResponse.json({error:"Retur belum memenuhi syarat refund"},{status:409});
  if(ret.refunds.length)return NextResponse.json({success:true,refund:serializeBigInt(ret.refunds[0])});
  if(body.data.amount>Number(ret.order.grandTotal))return NextResponse.json({error:"Nominal refund melebihi nilai pesanan"},{status:400});

  const nextReturnState = ret.source === "issue" ? "finished" : "refunded";
  const nextFulfillmentState = ret.source === "issue" ? "finished" : ret.order.fulfillmentState;
  const nextIssueOrder = ret.source === "issue" ? false : ret.order.issueOrder;

  const refund=await prisma.$transaction(async tx=>{
    const created=await tx.refund.create({
      data:{
        orderId:ret.orderId,
        paymentId:ret.order.payments[0].id,
        returnRequestId:ret.id,
        amount:BigInt(body.data.amount),
        status:"completed",
        method:body.data.method,
        reference:body.data.reference,
        proofObjectKey:body.data.proofObjectKey,
        processedBy:String(admin.email),
        processedAt:new Date()
      }
    });
    await tx.returnRequest.update({where:{id:ret.id},data:{state:nextReturnState}});
    await tx.order.update({
      where:{id:ret.orderId},
      data:{
        paymentState:body.data.amount===Number(ret.order.grandTotal)?"refunded":"partially_refunded",
        fulfillmentState:nextFulfillmentState,
        issueOrder:nextIssueOrder
      }
    });
    await tx.auditLog.create({
      data:{
        actorType:"admin",
        actorId:String(admin.email),
        action:"refund.completed",
        entityType:"refund",
        entityId:created.id,
        after:{amount:body.data.amount,reference:body.data.reference,proof:body.data.proofObjectKey}
      }
    });
    return created;
  });
  return NextResponse.json({success:true,refund:serializeBigInt(refund)});
}
