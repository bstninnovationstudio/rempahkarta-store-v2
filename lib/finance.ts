import { Prisma, type BiteshipLedgerType, type RevenueLedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calculatePaymentAmounts } from "@/lib/payment-amounts";

const ACCOUNT_ID = "primary";
const moneyReceivedStates = new Set(["paid", "refund_pending", "partially_refunded"]);
const availableFulfillmentStates = new Set(["completed", "finished"]);
const activeReturnStates = new Set([
  "requested", "under_review", "approved", "awaiting_handover", "in_transit", "received",
  "inspection_passed", "inspection_failed", "awaiting_approval", "waiting_waybill",
  "processing_return", "return_complete", "refund_pending", "processing_refund",
]);
const blockingCancellationStates = new Set(["requested", "approved", "provider_pending", "provider_failed"]);

export class BiteshipBalanceError extends Error {}

export function calculateRevenuePosition(input: {
  revenueAmount: bigint;
  refundedAmount: bigint;
  paymentState: string;
  fulfillmentState: string;
  issueOrder: boolean;
  returnStates: string[];
  cancellationStates: string[];
}) {
  const originalNet = input.revenueAmount > BigInt(0) ? input.revenueAmount : BigInt(0);
  const remainingNet = originalNet > input.refundedAmount ? originalNet - input.refundedAmount : BigInt(0);
  const hasMoney = moneyReceivedStates.has(input.paymentState);
  const canBecomeAvailable = hasMoney
    && availableFulfillmentStates.has(input.fulfillmentState)
    && !input.issueOrder
    && !input.returnStates.some(state => activeReturnStates.has(state))
    && !input.cancellationStates.some(state => blockingCancellationStates.has(state));
  return {
    originalNet,
    remainingNet,
    available: canBecomeAvailable ? remainingNet : BigInt(0),
    held: hasMoney && !canBecomeAvailable ? remainingNet : BigInt(0),
  };
}

export async function syncOrderRevenue(tx: Prisma.TransactionClient, orderId: string, actorId = "system") {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`);
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, publicNumber: true, subtotal: true, discountAmount: true, shippingFee: true,
      serviceFee: true, grandTotal: true, paymentState: true, fulfillmentState: true, issueOrder: true,
      payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { payableAmount: true, feeAmount: true, uniqueCode: true } },
      returns: { select: { state: true } }, cancellations: { select: { state: true } },
    },
  });
  if (!order) return null;
  const [refunds, current] = await Promise.all([
    tx.refund.aggregate({ where: { orderId, status: "completed" }, _sum: { amount: true } }),
    tx.revenueLedger.aggregate({ where: { orderId }, _sum: { availableDelta: true, heldDelta: true } }),
  ]);
  const refunded = refunds._sum.amount || BigInt(0);
  const payment = order.payments[0];
  const amounts = calculatePaymentAmounts({
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discountAmount: order.discountAmount,
    serviceFee: order.serviceFee,
    grandTotal: order.grandTotal,
    payableAmount: payment?.payableAmount,
    feeAmount: payment?.feeAmount,
    uniqueCode: payment?.uniqueCode,
  });
  const position = calculateRevenuePosition({ revenueAmount: amounts.revenueBeforeRefund, refundedAmount: refunded, paymentState: order.paymentState, fulfillmentState: order.fulfillmentState, issueOrder: order.issueOrder, returnStates: order.returns.map(item => item.state), cancellationStates: order.cancellations.map(item => item.state) });
  const remainingNet = position.remainingNet;
  const desiredAvailable = position.available;
  const desiredHeld = position.held;
  const currentAvailable = current._sum.availableDelta || BigInt(0);
  const currentHeld = current._sum.heldDelta || BigInt(0);
  const availableDelta = desiredAvailable - currentAvailable;
  const heldDelta = desiredHeld - currentHeld;
  if (availableDelta === BigInt(0) && heldDelta === BigInt(0)) return null;

  let type: RevenueLedgerType = "ORDER_HOLD";
  if (refunded > BigInt(0) && desiredAvailable + desiredHeld < currentAvailable + currentHeld) type = "ORDER_REFUND";
  else if (desiredAvailable > currentAvailable) type = "ORDER_AVAILABLE";
  else if (desiredAvailable === BigInt(0) && desiredHeld === BigInt(0)) type = "ORDER_RELEASE";

  return tx.revenueLedger.create({
    data: {
      orderId,
      dedupeKey: `revenue:${orderId}:${crypto.randomUUID()}`,
      type,
      availableDelta,
      heldDelta,
      grossAmount: amounts.payableAmount,
      productSubtotal: order.subtotal,
      shippingFee: order.shippingFee,
      serviceFee: order.serviceFee,
      adminFee: amounts.qrisFee,
      uniqueCode: amounts.uniqueCode,
      discountAmount: order.discountAmount,
      netAmount: remainingNet,
      notes: `${order.publicNumber} · ${order.paymentState}/${order.fulfillmentState}`,
      actorId,
    },
  });
}

export async function getRevenueStats() {
  const [balance, ledgerEntryCount, orderCountRows, totalWithdrawals] = await Promise.all([
    prisma.revenueLedger.aggregate({ _sum: { availableDelta: true, heldDelta: true } }),
    prisma.revenueLedger.count(),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(DISTINCT orderId) AS total FROM \`RevenueLedger\` WHERE orderId IS NOT NULL`),
    prisma.revenueLedger.aggregate({ where: { type: "WITHDRAWAL" }, _sum: { availableDelta: true } }),
  ]);
  const availableBalance = balance._sum.availableDelta || BigInt(0);
  const heldBalance = balance._sum.heldDelta || BigInt(0);
  const withdrawalDelta = totalWithdrawals._sum.availableDelta || BigInt(0);
  const totalWithdrawn = withdrawalDelta < BigInt(0) ? -withdrawalDelta : withdrawalDelta;
  return {
    availableBalance,
    heldBalance,
    totalTransactions: availableBalance + heldBalance + totalWithdrawn,
    orderTransactionCount: Number(orderCountRows[0]?.total || BigInt(0)),
    ledgerEntryCount,
    totalWithdrawn,
  };
}

export async function withdrawRevenue(input: { amount: bigint; notes?: string; actorId: string }) {
  return prisma.$transaction(async tx => {
    const sum = await tx.revenueLedger.aggregate({ _sum: { availableDelta: true } });
    const available = sum._sum.availableDelta || BigInt(0);
    if (input.amount <= BigInt(0) || input.amount > available) throw new Error("Nominal penarikan melebihi saldo yang dapat ditarik");
    const entry = await tx.revenueLedger.create({
      data: { dedupeKey: `withdrawal:${crypto.randomUUID()}`, type: "WITHDRAWAL", availableDelta: -input.amount, netAmount: input.amount, notes: input.notes || "Penarikan dana omzet", actorId: input.actorId },
    });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: input.actorId, action: "finance.revenue_withdrawn", entityType: "revenue_ledger", entityId: entry.id, after: { amount: input.amount.toString(), notes: input.notes } } });
    return entry;
  }, { isolationLevel: "Serializable" });
}

async function ensureBiteshipAccount(tx: Prisma.TransactionClient) {
  return tx.biteshipFundAccount.upsert({ where: { id: ACCOUNT_ID }, update: {}, create: { id: ACCOUNT_ID } });
}

export type BiteshipUsageKind = "area" | "rate" | "shipment" | "tracking";
export type BiteshipReservation = { ledgerId: string | null; amount: bigint };

function usageType(kind: BiteshipUsageKind): BiteshipLedgerType {
  if (kind === "area") return "USAGE_AREA";
  if (kind === "rate") return "USAGE_RATE";
  if (kind === "tracking") return "USAGE_TRACKING";
  return "USAGE_SHIPMENT";
}

export async function reserveBiteshipFunds(input: { kind: BiteshipUsageKind; amount?: bigint; referenceId?: string; dedupeKey?: string; notes: string; actorId?: string }): Promise<BiteshipReservation> {
  return prisma.$transaction(async tx => {
    await ensureBiteshipAccount(tx);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`BiteshipFundAccount\` WHERE id = ${ACCOUNT_ID} FOR UPDATE`);
    let ledgerDedupeKey = input.dedupeKey;
    if (ledgerDedupeKey) {
      const previous = await tx.biteshipLedger.findUnique({ where: { dedupeKey: ledgerDedupeKey } });
      if (previous) {
        const reversed = await tx.biteshipLedger.findUnique({ where: { dedupeKey: `biteship:reversal:${previous.id}` } });
        if (!reversed) return { ledgerId: null, amount: BigInt(0) };
        ledgerDedupeKey = `${ledgerDedupeKey}:retry:${crypto.randomUUID()}`;
      }
    }
    const account = await tx.biteshipFundAccount.findUniqueOrThrow({ where: { id: ACCOUNT_ID } });
    const configuredCost = input.kind === "area" ? account.areaSearchCost : input.kind === "rate" ? account.rateQuoteCost : input.kind === "tracking" ? account.trackingCheckCost : BigInt(0);
    const amount = input.amount ?? configuredCost;
    if (account.balance <= BigInt(0) || account.balance < amount) throw new BiteshipBalanceError("Saldo Biteship tidak mencukupi");
    if (amount === BigInt(0)) return { ledgerId: null, amount };
    const changed = await tx.biteshipFundAccount.updateMany({ where: { id: ACCOUNT_ID, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
    if (changed.count !== 1) throw new BiteshipBalanceError("Saldo Biteship tidak mencukupi");
    const ledger = await tx.biteshipLedger.create({ data: { type: usageType(input.kind), amount: -amount, referenceId: input.referenceId || null, dedupeKey: ledgerDedupeKey || `biteship:${input.kind}:${crypto.randomUUID()}`, notes: input.notes, actorId: input.actorId || "system" } });
    return { ledgerId: ledger.id, amount };
  }, { isolationLevel: "Serializable" });
}

export async function reverseBiteshipFunds(reservation: BiteshipReservation, notes: string) {
  if (!reservation.ledgerId || reservation.amount <= BigInt(0)) return;
  await prisma.$transaction(async tx => {
    const dedupeKey = `biteship:reversal:${reservation.ledgerId}`;
    const exists = await tx.biteshipLedger.findUnique({ where: { dedupeKey } });
    if (exists) return;
    await ensureBiteshipAccount(tx);
    await tx.biteshipFundAccount.update({ where: { id: ACCOUNT_ID }, data: { balance: { increment: reservation.amount } } });
    await tx.biteshipLedger.create({ data: { type: "REVERSAL", amount: reservation.amount, referenceId: reservation.ledgerId, dedupeKey, notes, actorId: "system" } });
  });
}

export async function getBiteshipAccount() {
  return prisma.biteshipFundAccount.upsert({ where: { id: ACCOUNT_ID }, update: {}, create: { id: ACCOUNT_ID } });
}

export async function getBiteshipStats() {
  const [account, summary, transactionCount] = await Promise.all([
    getBiteshipAccount(),
    prisma.biteshipLedger.groupBy({ by: ["type"], _sum: { amount: true } }),
    prisma.biteshipLedger.count(),
  ]);
  const amountFor = (types: BiteshipLedgerType[]) => summary
    .filter(item => types.includes(item.type))
    .reduce((total, item) => total + (item._sum.amount || BigInt(0)), BigInt(0));
  return {
    account,
    totalAdded: amountFor(["TOP_UP"]),
    totalUsed: -(amountFor(["DEDUCT_MANUAL", "USAGE_AREA", "USAGE_RATE", "USAGE_SHIPMENT", "USAGE_TRACKING"]) + amountFor(["REVERSAL"])),
    transactionCount,
  };
}

export async function createManualBiteshipEntry(input: { type: "TOP_UP" | "DEDUCT_MANUAL"; amount: bigint; notes: string; actorId: string }) {
  return prisma.$transaction(async tx => {
    await ensureBiteshipAccount(tx);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`BiteshipFundAccount\` WHERE id = ${ACCOUNT_ID} FOR UPDATE`);
    const account = await tx.biteshipFundAccount.findUniqueOrThrow({ where: { id: ACCOUNT_ID } });
    const signedAmount = input.type === "TOP_UP" ? input.amount : -input.amount;
    const nextBalance = account.balance + signedAmount;
    if (input.amount <= BigInt(0) || nextBalance < BigInt(0)) throw new BiteshipBalanceError("Saldo Biteship tidak mencukupi");
    const entry = await tx.biteshipLedger.create({ data: { type: input.type, amount: signedAmount, notes: input.notes, actorId: input.actorId, dedupeKey: `biteship:manual:${crypto.randomUUID()}` } });
    await tx.biteshipFundAccount.update({ where: { id: ACCOUNT_ID }, data: { balance: nextBalance } });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: input.actorId, action: "finance.biteship_entry_created", entityType: "biteship_ledger", entityId: entry.id, after: { type: input.type, amount: input.amount.toString(), notes: input.notes } } });
    return entry;
  }, { isolationLevel: "Serializable" });
}

export async function updateManualBiteshipEntry(input: { id: string; type: "TOP_UP" | "DEDUCT_MANUAL"; amount: bigint; notes: string; actorId: string }) {
  return prisma.$transaction(async tx => {
    await ensureBiteshipAccount(tx);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`BiteshipFundAccount\` WHERE id = ${ACCOUNT_ID} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`BiteshipLedger\` WHERE id = ${input.id} FOR UPDATE`);
    const [account, current] = await Promise.all([
      tx.biteshipFundAccount.findUniqueOrThrow({ where: { id: ACCOUNT_ID } }),
      tx.biteshipLedger.findUnique({ where: { id: input.id } }),
    ]);
    if (!current || !["TOP_UP", "DEDUCT_MANUAL"].includes(current.type)) throw new Error("Hanya catatan manual yang dapat diubah");
    const signedAmount = input.type === "TOP_UP" ? input.amount : -input.amount;
    const nextBalance = account.balance - current.amount + signedAmount;
    if (input.amount <= BigInt(0) || nextBalance < BigInt(0)) throw new BiteshipBalanceError("Perubahan membuat saldo Biteship menjadi negatif");
    const entry = await tx.biteshipLedger.update({ where: { id: input.id }, data: { type: input.type, amount: signedAmount, notes: input.notes, actorId: input.actorId } });
    await tx.biteshipFundAccount.update({ where: { id: ACCOUNT_ID }, data: { balance: nextBalance } });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: input.actorId, action: "finance.biteship_entry_updated", entityType: "biteship_ledger", entityId: entry.id, before: { type: current.type, amount: current.amount.toString(), notes: current.notes }, after: { type: input.type, amount: input.amount.toString(), notes: input.notes } } });
    return entry;
  }, { isolationLevel: "Serializable" });
}

export async function deleteManualBiteshipEntry(input: { id: string; actorId: string }) {
  return prisma.$transaction(async tx => {
    await ensureBiteshipAccount(tx);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`BiteshipFundAccount\` WHERE id = ${ACCOUNT_ID} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM \`BiteshipLedger\` WHERE id = ${input.id} FOR UPDATE`);
    const [account, current] = await Promise.all([
      tx.biteshipFundAccount.findUniqueOrThrow({ where: { id: ACCOUNT_ID } }),
      tx.biteshipLedger.findUnique({ where: { id: input.id } }),
    ]);
    if (!current || !["TOP_UP", "DEDUCT_MANUAL"].includes(current.type)) throw new Error("Hanya catatan manual yang dapat dihapus");
    const nextBalance = account.balance - current.amount;
    if (nextBalance < BigInt(0)) throw new BiteshipBalanceError("Catatan tidak dapat dihapus karena saldo telah digunakan");
    await tx.biteshipLedger.delete({ where: { id: input.id } });
    await tx.biteshipFundAccount.update({ where: { id: ACCOUNT_ID }, data: { balance: nextBalance } });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: input.actorId, action: "finance.biteship_entry_deleted", entityType: "biteship_ledger", entityId: input.id, before: { type: current.type, amount: current.amount.toString(), notes: current.notes } } });
    return current;
  }, { isolationLevel: "Serializable" });
}

export async function updateBiteshipCosts(input: { areaSearchCost: bigint; rateQuoteCost: bigint; trackingCheckCost: bigint; actorId: string }) {
  return prisma.$transaction(async tx => {
    const current = await ensureBiteshipAccount(tx);
    const account = await tx.biteshipFundAccount.update({ where: { id: ACCOUNT_ID }, data: { areaSearchCost: input.areaSearchCost, rateQuoteCost: input.rateQuoteCost, trackingCheckCost: input.trackingCheckCost } });
    await tx.auditLog.create({ data: { actorType: "admin", actorId: input.actorId, action: "finance.biteship_costs_updated", entityType: "biteship_fund", entityId: ACCOUNT_ID, before: { areaSearchCost: current.areaSearchCost.toString(), rateQuoteCost: current.rateQuoteCost.toString(), trackingCheckCost: current.trackingCheckCost.toString() }, after: { areaSearchCost: input.areaSearchCost.toString(), rateQuoteCost: input.rateQuoteCost.toString(), trackingCheckCost: input.trackingCheckCost.toString() } } });
    return account;
  });
}
