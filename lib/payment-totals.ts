import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function customerPaymentTotal(grandTotal: bigint | number, payableAmount?: bigint | number | null) {
  return payableAmount !== null && payableAmount !== undefined && payableAmount > 0
    ? payableAmount
    : grandTotal;
}

export async function getCustomerPaidTotal(userId: string, verifiedEmail?: string) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COALESCE(SUM(COALESCE((
      SELECT p.payableAmount
      FROM Payment p
      WHERE p.orderId = o.id
      ORDER BY p.createdAt DESC, p.id DESC
      LIMIT 1
    ), o.grandTotal)), 0) AS total
    FROM ${Prisma.raw("`Order`")} o
    WHERE (o.userId = ${userId}${verifiedEmail ? Prisma.sql` OR (o.userId IS NULL AND LOWER(o.guestEmail) = LOWER(${verifiedEmail}))` : Prisma.empty})
      AND (o.paymentState IN ('paid', 'refund_pending', 'partially_refunded', 'refunded') OR o.fulfillmentState IN ('completed', 'finished'))
  `);
  return BigInt(rows[0]?.total || 0);
}

export async function getPaidTotalsByUserIds(userIds: string[]) {
  if (!userIds.length) return new Map<string, bigint>();
  const rows = await prisma.$queryRaw<Array<{ userId: string; total: bigint }>>(Prisma.sql`
    SELECT o.userId, COALESCE(SUM(COALESCE((
      SELECT p.payableAmount
      FROM Payment p
      WHERE p.orderId = o.id
      ORDER BY p.createdAt DESC, p.id DESC
      LIMIT 1
    ), o.grandTotal)), 0) AS total
    FROM ${Prisma.raw("`Order`")} o
    WHERE o.userId IN (${Prisma.join(userIds)})
      AND (o.paymentState IN ('paid', 'refund_pending', 'partially_refunded', 'refunded') OR o.fulfillmentState IN ('completed', 'finished'))
    GROUP BY o.userId
  `);
  return new Map(rows.map(row => [row.userId, BigInt(row.total || 0)]));
}
