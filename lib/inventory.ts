import type { Prisma } from "@prisma/client";

/** Release an order reservation exactly once without allowing negative stock. */
export async function releaseOrderReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason: string,
) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.variantId) continue;
    const dedupeKey=`reservation_released:${orderId}:${item.variantId}`;
    if(await tx.inventoryMovement.findUnique({where:{dedupeKey}}))continue;
    const level = await tx.inventoryLevel.findFirst({
      where: { variantId: item.variantId },
      orderBy: { id: "asc" },
    });
    if (!level) throw new Error(`Inventory level tidak ditemukan untuk ${item.skuSnapshot}`);
    const released = await tx.inventoryLevel.updateMany({
      where: { id: level.id, reserved: { gte: item.quantity } },
      data: { reserved: { decrement: item.quantity }, version: { increment: 1 } },
    });
    if (released.count === 1) {
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          warehouseId: level.warehouseId,
          type: "reservation_released",
          quantityDelta: item.quantity,
          referenceType: "order",
          referenceId: orderId,
          reason,
          dedupeKey,
        },
      });
    } else {
      throw new Error(`Reservasi ${item.skuSnapshot} tidak valid saat dilepas`);
    }
  }
}

/** Convert reserved units to physical stock deduction after packing. */
export async function commitOrderReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.variantId) continue;
    const dedupeKey=`sale_committed:${orderId}:${item.variantId}`;
    if(await tx.inventoryMovement.findUnique({where:{dedupeKey}}))continue;
    const level = await tx.inventoryLevel.findFirst({
      where: { variantId: item.variantId },
      orderBy: { id: "asc" },
    });
    if (!level) throw new Error(`Inventory level tidak ditemukan untuk ${item.skuSnapshot}`);
    const committed = await tx.inventoryLevel.updateMany({
      where: {
        id: level.id,
        reserved: { gte: item.quantity },
        onHand: { gte: item.quantity },
      },
      data: {
        reserved: { decrement: item.quantity },
        onHand: { decrement: item.quantity },
        version: { increment: 1 },
      },
    });
    if (committed.count !== 1) throw new Error(`Reservasi ${item.skuSnapshot} tidak valid`);
    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        warehouseId: level.warehouseId,
        type: "sale_committed",
        quantityDelta: -item.quantity,
        referenceType: "order",
        referenceId: orderId,
        reason: "order_packed",
        dedupeKey,
      },
    });
  }
}

/** Put committed, not-yet-handed-over items back into sellable stock. */
export async function restockCommittedOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason: string,
) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.variantId) continue;
    const dedupeKey=`restock_cancelled:${orderId}:${item.variantId}`;
    if(await tx.inventoryMovement.findUnique({where:{dedupeKey}}))continue;
    const committed = await tx.inventoryMovement.findUnique({
      where: { dedupeKey: `sale_committed:${orderId}:${item.variantId}` },
    });
    if (!committed) throw new Error(`Penjualan ${item.skuSnapshot} belum pernah dikomit`);
    const level = await tx.inventoryLevel.findFirst({
      where: { variantId: item.variantId },
      orderBy: { id: "asc" },
    });
    if (!level) throw new Error(`Inventory level tidak ditemukan untuk ${item.skuSnapshot}`);
    await tx.inventoryLevel.update({
      where: { id: level.id },
      data: { onHand: { increment: item.quantity }, version: { increment: 1 } },
    });
    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        warehouseId: level.warehouseId,
        type: "restock_cancelled",
        quantityDelta: item.quantity,
        referenceType: "order",
        referenceId: orderId,
        reason,
        dedupeKey,
      },
    });
  }
}
