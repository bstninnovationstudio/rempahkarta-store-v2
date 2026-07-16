import { adminOrders, products } from "@/lib/demo-data";
import { isDemo } from "@/lib/env";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { getBiteshipStatusDetail } from "@/lib/shipping-state";

function fulfillmentForUi(value:string):OrderStatus{
  if(["packed","shipment_booked"].includes(value))return "processing";
  if(["handed_over","return_in_transit"].includes(value))return "in_transit";
  if(["returned"].includes(value))return "completed";
  if(value==="cancel_requested")return "processing";
  return (["awaiting_payment","awaiting_processing","processing","handover_pending","completed","cancelled","finished"] as string[]).includes(value)?value as OrderStatus:"awaiting_processing";
}
function paymentForUi(value:string):AdminOrder["payment"]{return value==="paid"?"paid":value==="refund_pending"?"refund_pending":"pending";}
function maskName(value:string){const parts=value.split(" ");return `${parts[0]} ${parts.slice(1).map(part=>`${part[0]||""}••••`).join(" ")}`.trim();}
function hasFulfillmentState(value:unknown,state:string){return typeof value==="object"&&value!==null&&"fulfillmentState" in value&&(value as {fulfillmentState?:unknown}).fulfillmentState===state;}

export async function getAdminOrders():Promise<AdminOrder[]>{
  if(isDemo())return adminOrders;
  const {prisma}=await import("@/lib/db");
  const rows=await prisma.order.findMany({orderBy:{createdAt:"desc"},take:100,include:{items:{take:1},shipments:{take:1}}});
  return rows.map((order,index)=>({number:order.publicNumber,customer:maskName(order.guestName),createdAt:new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jakarta"}).format(order.createdAt),total:Number(order.grandTotal),payment:paymentForUi(order.paymentState),fulfillment:fulfillmentForUi(order.fulfillmentState),courier:order.shipments[0]?`${order.shipments[0].courierCompany.toUpperCase()} ${order.shipments[0].courierType}`:"—",sla:order.fulfillmentState==="awaiting_processing"?"Perlu diproses":"Terpantau",item:order.items[0]?.nameSnapshot||"Produk AMK",image:products[index%products.length].image,issueOrder:order.issueOrder}));
}

export async function getInventoryRows(){
  if(isDemo())return products.map((product,index)=>({id:product.id,sku:`AMK-${index%3===0?"SHN":"NWS"}-${String(index+1).padStart(3,"0")}`,name:product.name,color:product.color,onHand:product.stock,reserved:index%3,safety:index===2?5:3,lowStockThreshold:5}));
  const {prisma}=await import("@/lib/db");
  const rows=await prisma.inventoryLevel.findMany({include:{variant:{include:{product:true}}},orderBy:{variant:{sku:"asc"}}});
  return rows.map(row=>({id:row.id,sku:row.variant.sku,name:row.variant.product.name,color:[row.variant.option1Value,row.variant.option2Value].filter(Boolean).join(" / ")||"Produk tunggal",onHand:row.onHand,reserved:row.reserved,safety:row.safetyStock,lowStockThreshold:row.variant.lowStockThreshold}));
}

export async function getProductRows(){
  if(isDemo())return products.map((product,index)=>({id:product.id,name:product.name,category:product.category,color:product.color,sku:`AMK-${index%3===0?"SHN":"NWS"}-${String(index+1).padStart(3,"0")}`,price:product.price,stock:product.stock,status:"active",image:product.image,isLow:product.stock<=5}));
  const {prisma}=await import("@/lib/db");
  const rows=await prisma.product.findMany({include:{category:true,images:{orderBy:{position:"asc"},take:1},variants:{where:{active:true},include:{inventory:true},orderBy:{position:"asc"}}},orderBy:{updatedAt:"desc"}});
  return rows.map((product,index)=>{const variant=product.variants[0];const stock=product.variants.reduce((total,item)=>total+item.inventory.reduce((sum,level)=>sum+Math.max(0,level.onHand-level.reserved-level.safetyStock),0),0);const isLow=product.variants.some(item=>item.inventory.reduce((sum,level)=>sum+Math.max(0,level.onHand-level.reserved-level.safetyStock),0)<=item.lowStockThreshold);return{id:product.id,name:product.name,category:product.category?.name||product.legacyCategory||"Tanpa kategori",color:product.hasVariants?`${product.variants.length} varian`:"Produk tunggal",sku:variant?.sku||"Belum ada detail",price:Number(variant?.price||0),stock,status:product.status,image:product.images[0]?.objectKey||products[index%products.length].image,isLow}});
}

export async function getShipmentRows(){
  if(isDemo())return adminOrders.slice(0,4).map((order,index)=>({number:order.number,courier:order.courier,waybill:index<2?`AMK12873219${8+index}`:"Belum tersedia",method:index%2?"Drop-off":"Pickup",status:order.fulfillment,updatedAt:order.createdAt}));
  const {prisma}=await import("@/lib/db");
  const rows=await prisma.shipment.findMany({include:{order:true},orderBy:{updatedAt:"desc"},take:100});
  return rows.map(row=>({number:row.order.publicNumber,courier:`${row.courierCompany.toUpperCase()} ${row.courierType}`,waybill:row.waybillId||row.trackingId||"Belum tersedia",method:row.collectionMethod==="drop_off"?"Drop-off":"Pickup",status:fulfillmentForUi(row.order.fulfillmentState),updatedAt:new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jakarta"}).format(row.updatedAt)}));
}

export async function getReturnRows(){
  if(isDemo())return [
    {id:"demo-return-1",number:"RET-260713-004",orderNumber:"ORD-20260712-7C1J",reason:"Produk rusak",cause:"damaged",state:"requested",refund:"refund_pending",amount:179000,createdAt:"13 Jul, 08.54",source:"buyer",type:"return"},
    {id:"demo-return-2",number:"RET-260712-003",orderNumber:"ORD-20260710-1B9R",reason:"Varian tidak sesuai",cause:"wrong",state:"in_transit",refund:"pending",amount:239000,createdAt:"12 Jul, 14.21",source:"buyer",type:"return"},
  ];
  const {prisma}=await import("@/lib/db");
  const rows=await prisma.returnRequest.findMany({include:{order:true,refunds:{orderBy:{createdAt:"desc"},take:1}},orderBy:{createdAt:"desc"},take:100});
  return rows.map(row=>({id:row.id,number:row.publicNumber,orderNumber:row.order.publicNumber,reason:row.reason,cause:row.cause,state:row.state,refund:row.refunds[0]?.status||row.state,amount:Number(row.refundAmount||0),createdAt:new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jakarta"}).format(row.createdAt),source:row.source,type:row.reason}));
}

export async function getAdminOrderDetail(number:string){
  if(isDemo()){
    const order=adminOrders.find(item=>item.number===number)||adminOrders[0];const product=products[0];
    return{number:order.number,createdAt:order.createdAt,customer:order.customer,email:"demo@amk.store",phone:"0812••••7890",address:"Jl. Contoh No. 88, Yogyakarta 55281",note:"Dekat pintu samping",paymentState:order.payment,fulfillmentState:order.fulfillment,subtotal:product.price,shippingFee:9000,grandTotal:order.total,payableAmount:order.total+82,items:[{id:"demo",sku:"RMP-KMN-RGL-100",name:order.item,options:"Regular · 100 g",quantity:1,price:product.price,image:product.image}],shipment:null,cancellation:null as {state:string;reason:string;decisionReason:string|null}|null,events:[{at:"09.44",title:"Pembayaran QRIS terverifikasi",note:"payment.finalized"},{at:"09.42",title:"Pesanan dibuat",note:"Stok direservasi"}],collectionMethods:["pickup"]};
  }
  const {prisma}=await import("@/lib/db");
  const order=await prisma.order.findUnique({where:{publicNumber:number},include:{items:true,addresses:true,payments:{orderBy:{createdAt:"desc"},take:1},quotes:{where:{selectedAt:{not:null}},orderBy:{createdAt:"desc"},take:1},shipments:{include:{events:{orderBy:{occurredAt:"desc"}}},orderBy:{createdAt:"desc"},take:1},cancellations:{orderBy:{requestedAt:"desc"}},returns:{include:{refunds:{orderBy:{createdAt:"desc"},take:1}},orderBy:{createdAt:"desc"}}}});
  if(!order)return null;
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "order",
      entityId: order.id,
      action: { in: ["order.processing", "order.packed", "order.manual_status"] }
    },
    orderBy: { createdAt: "asc" }
  });
  const address=order.addresses.find(item=>item.type==="shipping");const payment=order.payments[0];const shipment=order.shipments[0];const cancellation=order.cancellations[0];
  return{number:order.publicNumber,userId:order.userId,createdAt:new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(order.createdAt),customer:order.guestName,email:order.guestEmail,phone:order.guestPhone,address:address?.address||"—",note:address?.note||"",paymentState:order.paymentState,fulfillmentState:order.fulfillmentState,subtotal:Number(order.subtotal),shippingFee:Number(order.shippingFee),grandTotal:Number(order.grandTotal),payableAmount:Number(payment?.payableAmount||order.grandTotal),items:order.items.map((item,index)=>({id:item.id,sku:item.skuSnapshot,name:item.nameSnapshot,options:Object.values(item.optionsSnapshot as Record<string,string>).filter(Boolean).join(" · "),quantity:item.quantity,price:Number(item.unitPrice),image:products[index%products.length].image})),shipment:shipment?{status:shipment.status,courier:`${shipment.courierCompany.toUpperCase()} ${shipment.courierType}`,collectionMethod:shipment.collectionMethod,trackingId:shipment.trackingId,waybillId:shipment.waybillId,quotedPrice:Number(shipment.quotedPrice),actualPrice:Number(shipment.actualPrice||shipment.quotedPrice),priceAdjustment:Number(shipment.priceAdjustment),lastProviderSyncAt:shipment.lastProviderSyncAt?.toISOString()||null}:null,cancellation:cancellation?{state:cancellation.state,reason:cancellation.reason,decisionReason:cancellation.decisionReason}:null,events:(() => {
    const list: Array<{ time: Date; title: string; note: string }> = [];
    
    // 1. Add cancellation state events if any
    order.cancellations.forEach(cancel => {
      const isSeller = cancel.reason === "Dibatalkan langsung oleh admin" || cancel.reason === "Dibatalkan oleh penjual";
      
      if (cancel.state === "approved") {
        const isAutoApproved = cancel.decidedBy === "system" || cancel.reason.includes("Kadaluwarsa") || cancel.reason.includes("otomatis");
        list.push({
          time: cancel.decidedAt || cancel.requestedAt,
          title: isSeller ? "Dibatalkan oleh Penjual" : "Pembatalan Disetujui",
          note: isSeller
            ? `Alasan penjual: ${cancel.decisionReason || "Kebijakan penjual."}`
            : isAutoApproved
              ? "Pengajuan pembatalan telah disetujui otomatis."
              : `Pengajuan pembatalan telah disetujui. Alasan penjual: ${cancel.decisionReason || "Proses refund sedang disiapkan."}`
        });
      } else if (cancel.state === "rejected") {
        list.push({
          time: cancel.decidedAt || cancel.requestedAt,
          title: "Pengajuan Pembatalan Ditolak",
          note: `Ditolak oleh penjual. Alasan: ${cancel.decisionReason || "Pesanan tetap diproses."}`
        });
      } else if (cancel.state === "provider_failed") {
        list.push({
          time: cancel.decidedAt || cancel.requestedAt,
          title: "Pembatalan Bermasalah",
          note: "Gagal memproses pembatalan ke provider pengiriman."
        });
      } else if (cancel.state === "requested") {
        list.push({
          time: cancel.requestedAt,
          title: "Pembatalan Diajukan",
          note: `Alasan pembeli: ${cancel.reason}`
        });
      }
      
      // If the request was approved/rejected/provider_failed, also show when it was originally requested by the buyer
      if (cancel.state !== "requested" && !isSeller) {
        list.push({
          time: cancel.requestedAt,
          title: "Pembatalan Diajukan",
          note: `Alasan pembeli: ${cancel.reason}`
        });
      }
    });

    // 1.5. Add return/refund state events if any
    order.returns.forEach(ret => {
      if (ret.state === "awaiting_approval" || ret.state === "requested") {
        list.push({
          time: ret.updatedAt,
          title: "Proses Refund Didaftarkan",
          note: "Menunggu persetujuan Tim pengembalian dana."
        });
      } else if (["processing_refund", "refund_pending"].includes(ret.state)) {
        list.push({
          time: ret.updatedAt,
          title: "Proses Refund Disetujui",
          note: "Pengembalian dana sedang diproses."
        });
      } else if (["refunded", "finished", "closed"].includes(ret.state)) {
        list.push({
          time: ret.updatedAt,
          title: "Proses Refund Selesai",
          note: "Pengembalian dana telah dikirimkan."
        });
      } else if (ret.state === "rejected" || ret.state === "cancelled") {
        list.push({
          time: ret.updatedAt,
          title: "Proses Refund Tidak Disetuji",
          note: `Pengembalian dana tidak diproses. Alasan: ${ret.decisionReason || "Tidak memenuhi kriteria kebijakan."}`
        });
      }

      // Always show the original request creation
      list.push({
        time: ret.createdAt,
        title: "Refund Diajukan",
        note: `Alasan: ${ret.cause === "damaged" ? "Produk rusak/cacat" : ret.cause === "wrong" ? "Produk tidak sesuai" : "Pesanan tidak lengkap"}. Deskripsi: ${ret.description}`
      });
    });
    
    // 2. Add payment status events if expired or canceled
    if (order.paymentState === "expired") {
      list.push({
        time: order.updatedAt,
        title: "Batas Waktu Pembayaran Habis (Kadaluwarsa)",
        note: "Pesanan dibatalkan otomatis karena tidak ada pembayaran dalam 10 menit."
      });
    } else if (order.paymentState === "canceled" && !cancellation) {
      list.push({
        time: order.updatedAt,
        title: "Pembayaran Dibatalkan",
        note: "Pembayaran untuk pesanan ini telah dibatalkan."
      });
    }
    
    // 3. Add Biteship shipment tracking events (most recent first)
    if (shipment?.events.length) {
      const statusEvents = shipment.events.filter(event => {
        const detail = getBiteshipStatusDetail(event.providerStatus);
        return detail.category !== "Lainnya";
      });
      list.push(...statusEvents.map((event) => {
        const detail = getBiteshipStatusDetail(event.providerStatus);
        let note = event.note || detail.meaning;

        if (event.providerStatus === "order.price") {
          const payloadObj = event.payload as Record<string, unknown> | null;
          const newPrice = payloadObj?.price ?? payloadObj?.order_price;
          if (newPrice != null) {
            note = `Biaya pengiriman disesuaikan menjadi Rp ${Number(newPrice).toLocaleString("id-ID")}`;
          }
        } else if (event.providerStatus === "order.waybill_id") {
          const payloadObj = event.payload as Record<string, unknown> | null;
          const resi = payloadObj?.courier_waybill_id ?? payloadObj?.waybill_id ?? payloadObj?.courier_tracking_id;
          if (resi) {
            note = `Nomor resi pengiriman diterbitkan: ${resi}`;
          }
        }

        if (note.includes("Biteship")) {
          note = note.replace(/Booking Biteship dikonfirmasi/gi, "Pesanan memasuki proses pengiriman.")
                     .replace(/Sinkronisasi manual Biteship/gi, "Pembaruan status pengiriman.")
                     .replace(/Biteship/g, "kurir");
        }

        return {
          time: event.occurredAt,
          title: detail.label,
          note
        };
      }));
    } else if (shipment) {
      const detail = getBiteshipStatusDetail(shipment.status);
      list.push({
        time: shipment.createdAt,
        title: detail.label === "Pesanan dikonfirmasi" ? "Pengiriman dikonfirmasi" : (detail.label || "Pengiriman di-booking"),
        note: `Pengiriman dikonfirmasi · ${shipment.courierCompany.toUpperCase()} ${shipment.courierType}`
      });
    }

    // 4. Add fulfillment state events (processing / packed)
    const actualState = order.fulfillmentState === "cancelled" || order.fulfillmentState === "cancel_requested"
      ? (cancellation?.fulfillmentBefore || "awaiting_processing")
      : order.fulfillmentState;

    const wasProcessed = ["processing", "packed", "shipment_booked", "handed_over", "in_transit", "completed", "return_requested", "return_in_transit", "returned"].includes(actualState);
    const wasPacked = ["packed", "shipment_booked", "handed_over", "in_transit", "completed", "return_requested", "return_in_transit", "returned"].includes(actualState);

    const paidTime = payment?.paidAt || order.createdAt;

    // Extract real timestamps from AuditLogs if available
    const processingLog = auditLogs.find(l => 
      l.action === "order.processing" || 
      (l.action === "order.manual_status" && hasFulfillmentState(l.after,"processing"))
    );
    const packedLog = auditLogs.find(l => 
      l.action === "order.packed" || 
      (l.action === "order.manual_status" && hasFulfillmentState(l.after,"packed"))
    );

    if (wasProcessed) {
      const processedTime = processingLog?.createdAt || new Date(paidTime.getTime() + 1000);
      if (wasPacked) {
        // Deduct 1 second from shipment creation time if it exists, to ensure packing event is older than booking event
        const packedTime = packedLog?.createdAt || (shipment ? new Date(shipment.createdAt.getTime() - 1000) : new Date(processedTime.getTime() + 1000));
        list.push({
          time: packedTime,
          title: "Pesanan sudah dikemas",
          note: "Paket telah selesai dikemas dan siap dikirim."
        });
      }
      list.push({
        time: processedTime,
        title: "Pesanan sedang diproses",
        note: "Pesanan dikonfirmasi dan sedang disiapkan oleh penjual."
      });
    }

    // 5. Payment / created entry at the bottom
    list.push({
      time: order.createdAt,
      title: order.paymentState === "paid" ? "Pembayaran QRIS berhasil" : "Menunggu pembayaran QRIS",
      note: order.paymentState === "paid" ? "Pesanan diteruskan ke tim fulfillment" : "Status akan diperbarui otomatis"
    });
    
    // Sort chronologically descending
    list.sort((a, b) => b.time.getTime() - a.time.getTime());

    return list.map(event => {
      const d = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(event.time);
      const t = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(event.time).replace(/\./g, ":");
      return {
        at: `${d}, ${t}`,
        title: event.title,
        note: event.note
      };
    });
  })(),collectionMethods:Array.isArray(order.quotes[0]?.collectionMethods)?order.quotes[0].collectionMethods.map(String):["pickup"],issueOrder:order.issueOrder,issueReason:order.issueReason};
}
