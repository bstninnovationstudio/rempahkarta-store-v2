import { products } from "@/lib/demo-data";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { getBiteshipStatusDetail } from "@/lib/shipping-state";
import type { Prisma } from "@prisma/client";

function fulfillmentForUi(value:string):OrderStatus{
  if(["packed","shipment_booked"].includes(value))return "processing";
  if(["handed_over","return_in_transit"].includes(value))return "in_transit";
  if(["returned"].includes(value))return "completed";
  return (["awaiting_payment","awaiting_processing","processing","handover_pending","completed","cancelled","cancel_requested","finished"] as string[]).includes(value)?value as OrderStatus:"awaiting_processing";
}
function paymentForUi(value:string):AdminOrder["payment"]{return value==="paid"?"paid":value==="refund_pending"?"refund_pending":"pending";}
function maskName(value:string){const parts=value.split(" ");return `${parts[0]} ${parts.slice(1).map(part=>`${part[0]||""}••••`).join(" ")}`.trim();}
function hasFulfillmentState(value:unknown,state:string){return typeof value==="object"&&value!==null&&"fulfillmentState" in value&&(value as {fulfillmentState?:unknown}).fulfillmentState===state;}

const DEFAULT_ADMIN_PAGE_SIZE = 20;
const MAX_ADMIN_PAGE_SIZE = 50;

export type AdminPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export type AdminOrderFilter = "processing" | "pickup" | "intransit" | "cancel" | "issue";

function safePage(value: number | undefined) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Math.min(Number(value), 100_000) : 1;
}

function safePageSize(value: number | undefined) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) return DEFAULT_ADMIN_PAGE_SIZE;
  return Math.min(Number(value), MAX_ADMIN_PAGE_SIZE);
}

function pagination(page: number, pageSize: number, total: number): AdminPagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  return {
    page: normalizedPage,
    pageSize,
    total,
    totalPages,
    from: total === 0 ? 0 : (normalizedPage - 1) * pageSize + 1,
    to: total === 0 ? 0 : Math.min(normalizedPage * pageSize, total),
  };
}

import { getCourierDisplayName } from "@/lib/shipping-utils";

function adminDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(value);
}

function adminOrderWhere(filter?: string): Prisma.OrderWhereInput {
  if (filter === "processing") return { fulfillmentState: { in: ["awaiting_processing", "processing", "packed", "shipment_booked"] } };
  if (filter === "pickup") return { fulfillmentState: "handover_pending" };
  if (filter === "intransit") return { fulfillmentState: { in: ["handed_over", "return_in_transit"] } };
  if (filter === "cancel" || filter === "cancellation") return { OR: [{ cancellations: { some: {} } }, { fulfillmentState: "cancelled" }] };
  if (filter === "issue") return { issueOrder: true };
  return {}; // covers "all" and undefined (default processing handled in page)
}

function mapAdminOrder(order: {
  publicNumber: string;
  guestName: string;
  createdAt: Date;
  grandTotal: bigint;
  paymentState: string;
  fulfillmentState: string;
  issueOrder: boolean;
  items: Array<{ nameSnapshot: string }>;
  shipments: Array<{ courierCompany: string; courierType: string; courierName?: string | null }>;
}, index: number): AdminOrder {
  return {
    number: order.publicNumber,
    customer: maskName(order.guestName),
    createdAt: adminDate(order.createdAt),
    total: Number(order.grandTotal),
    payment: paymentForUi(order.paymentState),
    fulfillment: fulfillmentForUi(order.fulfillmentState),
    courier: order.shipments[0] ? getCourierDisplayName(order.shipments[0].courierName, order.shipments[0].courierCompany, order.shipments[0].courierType) : "—",
    sla: order.fulfillmentState === "awaiting_processing" ? "Perlu diproses" : "",
    item: order.items[0]?.nameSnapshot || "Produk REMPAHKARTA",
    image: products[index % products.length]?.image || "/main-logo.webp",
    issueOrder: order.issueOrder,
  };
}

export async function getAdminDashboardData() {
  const { prisma } = await import("@/lib/db");
  const { checkAndExpireAllStaleOrders } = await import("@/lib/payment-sync");
  await checkAndExpireAllStaleOrders();
  const [rows, totalOrders, paidSales, needProcess, pickup] = await prisma.$transaction([
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 4, include: { items: { take: 1 }, shipments: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.order.count(),
    prisma.order.aggregate({ where: { paymentState: "paid" }, _sum: { grandTotal: true } }),
    prisma.order.count({ where: { fulfillmentState: "awaiting_processing" } }),
    prisma.order.count({ where: { fulfillmentState: "handover_pending" } }),
  ]);
  return {
    latestOrders: rows.map(mapAdminOrder),
    stats: { totalOrders, paidSales: Number(paidSales._sum.grandTotal || 0), needProcess, pickup },
  };
}

export async function getAdminOrdersPage(options: { page?: number; pageSize?: number; filter?: string } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const where = adminOrderWhere(options.filter);
  const validFilter = ["processing", "pickup", "intransit", "cancel", "cancellation", "issue"].includes(options.filter || "")
    ? (options.filter === "cancellation" ? "cancel" : options.filter) as AdminOrderFilter
    : undefined;

  const { prisma } = await import("@/lib/db");
  const { checkAndExpireAllStaleOrders } = await import("@/lib/payment-sync");
  await checkAndExpireAllStaleOrders();
  const [total, fulfillmentGroups, issue, cancel] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["fulfillmentState"], orderBy: { fulfillmentState: "asc" }, _count: { id: true } }),
    prisma.order.count({ where: { issueOrder: true } }),
    prisma.order.count({ where: { OR: [{ cancellations: { some: {} } }, { fulfillmentState: "cancelled" }] } }),
  ]);
  const pageInfo = pagination(requestedPage, pageSize, total);
  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (pageInfo.page - 1) * pageSize,
    take: pageSize,
    include: { items: { take: 1 }, shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const countFor = (...states: string[]) => fulfillmentGroups
    .filter(group => states.includes(group.fulfillmentState))
    .reduce((sum, group) => sum + group._count.id, 0);
  const all = fulfillmentGroups.reduce((sum, group) => sum + group._count.id, 0);
  return {
    rows: rows.map(mapAdminOrder),
    pagination: pageInfo,
    counts: {
      all,
      processing: countFor("awaiting_processing", "processing", "packed", "shipment_booked"),
      pickup: countFor("handover_pending"),
      intransit: countFor("handed_over", "return_in_transit"),
      cancel,
      issue,
    },
    filter: validFilter,
  };
}

export async function getInventoryPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);

  const { prisma } = await import("@/lib/db");
  const [total, sums, availabilityResult] = await Promise.all([
    prisma.inventoryLevel.count(),
    prisma.inventoryLevel.aggregate({ _sum: { onHand: true, reserved: true, safetyStock: true } }),
    prisma.$queryRaw<Array<{ available: bigint; low: bigint }>>`
      SELECT
        COALESCE(SUM(GREATEST(0, inventory.onHand - inventory.reserved - inventory.safetyStock)), 0) AS available,
        SUM(CASE WHEN inventory.onHand - inventory.reserved - inventory.safetyStock <= variant.lowStockThreshold THEN 1 ELSE 0 END) AS low
      FROM InventoryLevel inventory
      INNER JOIN ProductVariant variant ON variant.id = inventory.variantId
    `,
  ]);
  const pageInfo = pagination(requestedPage, pageSize, total);
  const rows = await prisma.inventoryLevel.findMany({
    skip: (pageInfo.page - 1) * pageSize,
    take: pageSize,
    include: { variant: { include: { product: true } } },
    orderBy: { variant: { sku: "asc" } },
  });
  const onHand = sums._sum.onHand || 0;
  const reserved = sums._sum.reserved || 0;
  return {
    rows: rows.map(row=>({id:row.id,sku:row.variant.sku,name:row.variant.product.name,color:[row.variant.option1Value,row.variant.option2Value].filter(Boolean).join(" / ")||"Produk tunggal",onHand:row.onHand,reserved:row.reserved,safety:row.safetyStock,lowStockThreshold:row.variant.lowStockThreshold})),
    pagination: pageInfo,
    stats: { onHand, reserved, available: Number(availabilityResult[0]?.available || 0), low: Number(availabilityResult[0]?.low || 0) },
  };
}

export async function getProductRowsPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);

  const { prisma } = await import("@/lib/db");
  const total = await prisma.product.count();
  const pageInfo = pagination(requestedPage, pageSize, total);
  const rows = await prisma.product.findMany({skip:(pageInfo.page-1)*pageSize,take:pageSize,include:{category:true,images:{orderBy:{position:"asc"},take:1},variants:{where:{active:true},include:{inventory:true},orderBy:{position:"asc"}}},orderBy:[{updatedAt:"desc"},{id:"desc"}]});
  return {
    rows: rows.map((product,index)=>{const variant=product.variants[0];const stock=product.variants.reduce((total,item)=>total+item.inventory.reduce((sum,level)=>sum+Math.max(0,level.onHand-level.reserved-level.safetyStock),0),0);const isLow=product.variants.some(item=>item.inventory.reduce((sum,level)=>sum+Math.max(0,level.onHand-level.reserved-level.safetyStock),0)<=item.lowStockThreshold);return{id:product.id,name:product.name,category:product.category?.name||product.legacyCategory||"Tanpa kategori",color:product.hasVariants?`${product.variants.length} varian`:"Produk tunggal",sku:variant?.sku||"Belum ada detail",price:Number(variant?.price||0),stock,status:product.status,image:product.images[0]?.objectKey||products[index%products.length]?.image||"/main-logo.webp",isLow}}),
    pagination: pageInfo,
  };
}

export async function getShipmentRowsPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);

  const { prisma } = await import("@/lib/db");
  const issueStatuses = ["cancelled", "rejected", "courier_not_found", "disposed"];
  const [total, awaitingPickup, inTransit, issue] = await prisma.$transaction([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { order: { fulfillmentState: "handover_pending" } } }),
    prisma.shipment.count({ where: { order: { fulfillmentState: { in: ["handed_over", "return_in_transit"] } } } }),
    prisma.shipment.count({ where: { status: { in: issueStatuses } } }),
  ]);
  const pageInfo = pagination(requestedPage, pageSize, total);
  const rows=await prisma.shipment.findMany({skip:(pageInfo.page-1)*pageSize,take:pageSize,include:{order:true},orderBy:[{updatedAt:"desc"},{id:"desc"}]});
  return { rows:rows.map(row=>({number:row.order.publicNumber,courier:getCourierDisplayName(row.courierName, row.courierCompany, row.courierType),waybill:row.waybillId||row.trackingId||"Belum tersedia",method:row.collectionMethod==="drop_off"?"Drop-off":"Pickup",status:fulfillmentForUi(row.order.fulfillmentState),updatedAt:adminDate(row.updatedAt)})), pagination: pageInfo, stats: { total, awaitingPickup, inTransit, issue } };
}

export async function getReturnRowsPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);

  const { prisma } = await import("@/lib/db");
  const [total, groups] = await Promise.all([
    prisma.returnRequest.count(),
    prisma.returnRequest.groupBy({ by: ["state"], orderBy: { state: "asc" }, _count: { id: true } }),
  ]);
  const pageInfo = pagination(requestedPage, pageSize, total);
  const rows=await prisma.returnRequest.findMany({skip:(pageInfo.page-1)*pageSize,take:pageSize,include:{order:{select:{publicNumber:true}},refunds:{orderBy:{createdAt:"desc"},take:1}},orderBy:[{createdAt:"desc"},{id:"desc"}]});
  const countFor = (...states: string[]) => groups.filter(group => states.includes(group.state)).reduce((sum, group) => sum + group._count.id, 0);
  return {
    rows:rows.map(row=>({id:row.id,number:row.publicNumber,orderNumber:row.order.publicNumber,reason:row.reason,cause:row.cause,state:row.state,refund:row.refunds[0]?.status||row.state,amount:Number(row.refundAmount||0),createdAt:adminDate(row.createdAt),source:row.source,type:row.reason})),
    pagination: pageInfo,
    stats: { review: countFor("requested", "under_review", "awaiting_approval"), transit: countFor("approved", "awaiting_handover", "in_transit", "waiting_waybill", "processing_return"), inspection: countFor("received", "return_complete"), refund: countFor("refund_pending", "processing_refund") },
  };
}

export async function getAdminUsersPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const { prisma } = await import("@/lib/db");
  const total = await prisma.user.count();
  const pageInfo = pagination(requestedPage, pageSize, total);
  const users = await prisma.user.findMany({
    skip: (pageInfo.page - 1) * pageSize,
    take: pageSize,
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, _count: { select: { orders: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const totals = users.length ? await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map(user => user.id) }, OR: [{ paymentState: "paid" }, { fulfillmentState: "completed" }] },
    _sum: { grandTotal: true },
  }) : [];
  const spentByUser = new Map(totals.map(item => [item.userId, Number(item._sum.grandTotal || 0)]));
  return {
    rows: users.map(user => ({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, createdAt: user.createdAt, totalOrders: user._count.orders, totalSpent: spentByUser.get(user.id) || 0 })),
    pagination: pageInfo,
  };
}

export async function getAuditLogPage(options: { page?: number; pageSize?: number; filter?: string } = {}) {
  const requestedPage = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const filter = ["order", "inventory", "catalog", "shipping", "returns"].includes(options.filter || "") ? options.filter : undefined;
  const entityTypes = filter === "catalog" ? ["product", "category"]
    : filter === "shipping" ? ["shipment"]
      : filter === "returns" ? ["return", "refund", "return_request"]
        : filter ? [filter] : [];
  const where: Prisma.AuditLogWhereInput = entityTypes.length ? { entityType: { in: entityTypes } } : {};
  const { prisma } = await import("@/lib/db");
  const total = await prisma.auditLog.count({ where });
  const pageInfo = pagination(requestedPage, pageSize, total);
  const rows = await prisma.auditLog.findMany({
    where,
    skip: (pageInfo.page - 1) * pageSize,
    take: pageSize,
    select: { id: true, createdAt: true, actorType: true, actorId: true, action: true, entityType: true, entityId: true, before: true, after: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return {
    rows: rows.map(row => ({
      id: row.id,
      createdAt: new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(row.createdAt),
      actor: row.actorId ? `${row.actorType} · ${row.actorId}` : row.actorType,
      action: row.action,
      entity: `${row.entityType} · ${row.entityId}`,
      summary: row.before && row.after ? "Nilai sebelum dan sesudah direkam" : row.after ? "Nilai baru direkam" : row.before ? "Nilai sebelumnya direkam" : "Aktivitas direkam",
    })),
    pagination: pageInfo,
    filter,
  };
}

export async function getAdminOrderDetail(number:string){

  const {prisma}=await import("@/lib/db");
  const { checkAndExpireOrder } = await import("@/lib/payment-sync");
  await checkAndExpireOrder(number);
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
  const address=order.addresses.find(item=>item.type==="shipping");const payment=order.payments[0];const shipment=order.shipments[0];const cancellation=order.cancellations[0];const quote=order.quotes[0];
  const { getCourierDisplayName } = await import("@/lib/shipping-utils");
  const quoteCourier = quote ? getCourierDisplayName(quote.courierName, quote.courierCompany, quote.courierType) : null;
  return{number:order.publicNumber,userId:order.userId,createdAt:new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(order.createdAt),customer:order.guestName,email:order.guestEmail,phone:order.guestPhone,address:address?.address||"—",note:address?.note||"",paymentState:order.paymentState,fulfillmentState:order.fulfillmentState,subtotal:Number(order.subtotal),shippingFee:Number(order.shippingFee),serviceFee:Number(order.serviceFee),grandTotal:Number(order.grandTotal),payableAmount:Number(payment?.payableAmount||order.grandTotal),quoteCourier,items:order.items.map((item,index)=>({id:item.id,sku:item.skuSnapshot,name:item.nameSnapshot,options:Object.values(item.optionsSnapshot as Record<string,string>).filter(Boolean).join(" · "),quantity:item.quantity,price:Number(item.unitPrice),image:products[index%products.length].image})),shipment:shipment?{status:shipment.status,courier:getCourierDisplayName(shipment.courierName, shipment.courierCompany, shipment.courierType),collectionMethod:shipment.collectionMethod,trackingId:shipment.trackingId,waybillId:shipment.waybillId,quotedPrice:Number(shipment.quotedPrice),actualPrice:Number(shipment.actualPrice||shipment.quotedPrice),priceAdjustment:Number(shipment.priceAdjustment),lastProviderSyncAt:shipment.lastProviderSyncAt?.toISOString()||null}:null,cancellation:cancellation?{state:cancellation.state,reason:cancellation.reason,decisionReason:cancellation.decisionReason}:null,events:(() => {
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
