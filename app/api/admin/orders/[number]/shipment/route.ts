import { NextResponse } from "next/server";
import { z } from "zod";
import { BiteshipAdapter, normalizeBiteshipStatus } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { serializeBigInt } from "@/lib/serialize";

const schema=z.object({collectionMethod:z.enum(["pickup","drop_off"]),deliveryType:z.enum(["now","scheduled"]),deliveryDate:z.string().optional(),deliveryTime:z.string().optional()});

export async function POST(request:Request,{params}:{params:Promise<{number:string}>}){
  const admin=await adminFromRequest();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=schema.safeParse(await request.json());if(!body.success)return NextResponse.json({error:"Payload tidak valid"},{status:400});
  if(!process.env.BITESHIP_API_KEY)return NextResponse.json({error:"BITESHIP_API_KEY belum diisi"},{status:503});
  const {number}=await params;
  const order=await prisma.order.findUnique({where:{publicNumber:number},include:{items:true,addresses:true,quotes:{where:{selectedAt:{not:null}},orderBy:{createdAt:"desc"},take:1},shipments:{orderBy:{createdAt:"desc"},take:1}}});
  if(!order)return NextResponse.json({error:"Pesanan tidak ditemukan"},{status:404});
  if(order.shipments[0])return NextResponse.json({success:true,shipment:serializeBigInt(order.shipments[0])});
  if(order.paymentState!=="paid")return NextResponse.json({error:"Pengiriman hanya dapat dibooking setelah pembayaran terverifikasi"},{status:409});
  if(order.fulfillmentState!=="packed")return NextResponse.json({error:"Pesanan harus ditandai sudah dikemas sebelum booking pengiriman"},{status:409});
  const warehouse=await prisma.warehouse.findFirst({where:{isDefault:true}});const destination=order.addresses.find(a=>a.type==="shipping");const quote=order.quotes[0];
  if(!warehouse||!destination||!quote)return NextResponse.json({error:"Data pengiriman belum lengkap"},{status:409});
  const allowed=Array.isArray(quote.collectionMethods)?quote.collectionMethods.map(String):["pickup"];
  if(!allowed.includes(body.data.collectionMethod))return NextResponse.json({error:`Metode ${body.data.collectionMethod} tidak tersedia untuk layanan ini`},{status:409});
  const adapter=new BiteshipAdapter(process.env.BITESHIP_BASE_URL||"https://api.biteship.com",process.env.BITESHIP_API_KEY);const reference=`SHP-${order.publicNumber}`;
  try{
    const result=await adapter.createOrder({reference_id:reference,shipper_contact_name:warehouse.contactName,shipper_contact_phone:warehouse.contactPhone,shipper_organization:"REMPAHKARTA",origin_contact_name:warehouse.contactName,origin_contact_phone:warehouse.contactPhone,origin_address:warehouse.address,origin_postal_code:Number(warehouse.postalCode),origin_area_id:warehouse.areaId,origin_collection_method:body.data.collectionMethod,destination_contact_name:destination.contactName,destination_contact_phone:destination.contactPhone,destination_contact_email:destination.contactEmail,destination_address:destination.address,destination_note:destination.note,destination_postal_code:Number(destination.postalCode),destination_area_id:destination.areaId,courier_company:quote.courierCompany,courier_type:quote.courierType,delivery_type:body.data.deliveryType,delivery_date:body.data.deliveryDate,delivery_time:body.data.deliveryTime,metadata:{order_number:order.publicNumber},items:order.items.map(i=>({name:i.nameSnapshot,description:Object.values(i.optionsSnapshot as Record<string,string>).filter(Boolean).join(" / "),category:"food_and_drink",sku:i.skuSnapshot,value:Number(i.unitPrice),quantity:i.quantity,weight:i.weight,length:i.length,width:i.width,height:i.height}))});
    const actual=BigInt(result.price??Number(quote.price));const status=normalizeBiteshipStatus(result.status);
    const rawResult=JSON.parse(JSON.stringify(result));
    const payloadHash=await sha256(JSON.stringify(rawResult));
    const shipment=await prisma.$transaction(async tx=>{const created=await tx.shipment.create({data:{orderId:order.id,warehouseId:warehouse.id,providerOrderId:result.id,referenceId:reference,trackingId:result.courier?.tracking_id||null,waybillId:result.courier?.waybill_id||null,courierCompany:quote.courierCompany,courierType:quote.courierType,collectionMethod:body.data.collectionMethod,quotedPrice:quote.price,actualPrice:actual,priceAdjustment:actual-quote.price,status,raw:rawResult}});await tx.shipmentTrackingEvent.upsert({where:{shipmentId_payloadHash:{shipmentId:created.id,payloadHash}},update:{},create:{shipmentId:created.id,providerStatus:status,note:"Pesanan memasuki proses pengiriman.",occurredAt:new Date(),payloadHash,payload:rawResult}});await tx.order.update({where:{id:order.id},data:{fulfillmentState:"shipment_booked"}});await tx.auditLog.create({data:{actorType:"admin",actorId:String(admin.email),action:"shipment.booked",entityType:"shipment",entityId:created.id,after:{status,collectionMethod:body.data.collectionMethod,waybillId:result.courier?.waybill_id,quotedPrice:quote.price.toString(),actualPrice:actual.toString()}}});return created});
    return NextResponse.json({success:true,shipment:serializeBigInt(shipment)});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Booking Biteship gagal"},{status:502})}
}
