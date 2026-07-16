import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

const schema=z.object({decision:z.enum(["approved","rejected"]),reason:z.string().min(3),refundAmount:z.number().int().positive().optional()});

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const admin=await adminFromRequest();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});const body=schema.safeParse(await request.json());if(!body.success)return NextResponse.json({error:"Payload tidak valid"},{status:400});const {id}=await params;
  const current=await prisma.returnRequest.findUnique({where:{id},include:{order:true}});
  if(!current||!["requested","under_review","awaiting_approval"].includes(current.state))return NextResponse.json({error:"Retur sudah diputuskan"},{status:409});
  if(body.data.refundAmount&&body.data.refundAmount>Number(current.order.grandTotal))return NextResponse.json({error:"Nominal refund melebihi nilai pesanan"},{status:400});
  
  const nextState = body.data.decision === "rejected"
    ? (current.source === "issue" ? "cancelled" : "rejected")
    : (current.reason === "refund"
      ? (current.source === "issue" ? "processing_refund" : "refund_pending")
      : (current.source === "issue" ? "waiting_waybill" : "approved"));

  const updated=await prisma.$transaction(async tx=>{
    const changed=await tx.returnRequest.update({
      where:{id},
      data:{
        state:nextState,
        decisionReason:body.data.reason,
        refundAmount:body.data.refundAmount?BigInt(body.data.refundAmount):undefined
      }
    });
    if(body.data.decision==="rejected"){
      await tx.order.update({
        where:{id:current.orderId},
        data:{fulfillmentState:"completed"}
      });
    }
    await tx.auditLog.create({
      data:{
        actorType:"admin",
        actorId:String(admin.email),
        action:`return.${body.data.decision}`,
        entityType:"return",
        entityId:id,
        after:{reason:body.data.reason,refundAmount:body.data.refundAmount,state:nextState}
      }
    });
    return changed;
  });
  return NextResponse.json({success:true,return:serializeBigInt(updated)});
}
