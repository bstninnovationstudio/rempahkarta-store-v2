ALTER TABLE `Payment`
  ADD COLUMN `uniqueCode` BIGINT NOT NULL DEFAULT 0 AFTER `feeAmount`;

ALTER TABLE `RevenueLedger`
  ADD COLUMN `productSubtotal` BIGINT NOT NULL DEFAULT 0 AFTER `grossAmount`,
  ADD COLUMN `uniqueCode` BIGINT NOT NULL DEFAULT 0 AFTER `adminFee`;

-- Pembayaran lama belum memiliki snapshot terpisah. Selisih total QRIS dengan
-- total invoice sebelum kode unik adalah sumber backfill yang deterministik.
UPDATE `Payment` p
INNER JOIN `Order` o ON o.`id` = p.`orderId`
SET p.`uniqueCode` = GREATEST(0, COALESCE(p.`payableAmount`, o.`grandTotal`) - o.`grandTotal`);

UPDATE `RevenueLedger` rl
INNER JOIN `Order` o ON o.`id` = rl.`orderId`
LEFT JOIN `Payment` p ON p.`id` = (
  SELECT p2.`id`
  FROM `Payment` p2
  WHERE p2.`orderId` = o.`id`
  ORDER BY p2.`createdAt` DESC, p2.`id` DESC
  LIMIT 1
)
SET
  rl.`productSubtotal` = o.`subtotal`,
  rl.`uniqueCode` = COALESCE(p.`uniqueCode`, 0);

CREATE TEMPORARY TABLE `_RevenueUniqueCodeReconcile20260722` AS
SELECT
  base.`orderId`,
  base.`grossAmount`,
  base.`productSubtotal`,
  base.`shippingFee`,
  base.`serviceFee`,
  base.`qrisFee`,
  base.`uniqueCode`,
  base.`discountAmount`,
  base.`remainingNet`,
  base.`currentAvailable`,
  base.`currentHeld`,
  CASE WHEN base.`canBecomeAvailable` = 1 THEN base.`remainingNet` ELSE 0 END AS `desiredAvailable`,
  CASE WHEN base.`hasMoney` = 1 AND base.`canBecomeAvailable` = 0 THEN base.`remainingNet` ELSE 0 END AS `desiredHeld`
FROM (
  SELECT
    o.`id` AS `orderId`,
    COALESCE(p.`payableAmount`, o.`grandTotal`) AS `grossAmount`,
    o.`subtotal` AS `productSubtotal`,
    o.`shippingFee`,
    o.`serviceFee`,
    COALESCE(p.`feeAmount`, 0) AS `qrisFee`,
    COALESCE(p.`uniqueCode`, 0) AS `uniqueCode`,
    o.`discountAmount`,
    GREATEST(
      0,
      GREATEST(0, o.`subtotal` - o.`discountAmount`)
        + o.`shippingFee`
        + COALESCE(p.`uniqueCode`, 0)
        - COALESCE(refunds.`amount`, 0)
    ) AS `remainingNet`,
    COALESCE(ledger.`available`, 0) AS `currentAvailable`,
    COALESCE(ledger.`held`, 0) AS `currentHeld`,
    CASE WHEN o.`paymentState` IN ('paid', 'refund_pending', 'partially_refunded') THEN 1 ELSE 0 END AS `hasMoney`,
    CASE
      WHEN o.`paymentState` IN ('paid', 'refund_pending', 'partially_refunded')
        AND o.`fulfillmentState` IN ('completed', 'finished')
        AND o.`issueOrder` = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM `ReturnRequest` rr
          WHERE rr.`orderId` = o.`id`
            AND rr.`state` IN (
              'requested', 'under_review', 'approved', 'awaiting_handover', 'in_transit',
              'received', 'inspection_passed', 'inspection_failed', 'awaiting_approval',
              'waiting_waybill', 'processing_return', 'return_complete', 'refund_pending',
              'processing_refund'
            )
        )
        AND NOT EXISTS (
          SELECT 1 FROM `CancellationRequest` cr
          WHERE cr.`orderId` = o.`id`
            AND cr.`state` IN ('requested', 'approved', 'provider_pending', 'provider_failed')
        )
      THEN 1 ELSE 0
    END AS `canBecomeAvailable`
  FROM `Order` o
  LEFT JOIN `Payment` p ON p.`id` = (
    SELECT p2.`id`
    FROM `Payment` p2
    WHERE p2.`orderId` = o.`id`
    ORDER BY p2.`createdAt` DESC, p2.`id` DESC
    LIMIT 1
  )
  LEFT JOIN (
    SELECT r.`orderId`, SUM(r.`amount`) AS `amount`
    FROM `Refund` r
    WHERE r.`status` = 'completed'
    GROUP BY r.`orderId`
  ) refunds ON refunds.`orderId` = o.`id`
  LEFT JOIN (
    SELECT rl.`orderId`, SUM(rl.`availableDelta`) AS `available`, SUM(rl.`heldDelta`) AS `held`
    FROM `RevenueLedger` rl
    WHERE rl.`orderId` IS NOT NULL
    GROUP BY rl.`orderId`
  ) ledger ON ledger.`orderId` = o.`id`
  WHERE ledger.`orderId` IS NOT NULL
    OR o.`paymentState` IN ('paid', 'refund_pending', 'partially_refunded')
) base;

INSERT INTO `RevenueLedger` (
  `id`, `orderId`, `dedupeKey`, `type`, `availableDelta`, `heldDelta`,
  `grossAmount`, `productSubtotal`, `shippingFee`, `serviceFee`, `adminFee`, `uniqueCode`,
  `discountAmount`, `netAmount`, `notes`, `actorId`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('rev_', LEFT(REPLACE(UUID(), '-', ''), 24)),
  reconciliation.`orderId`,
  CONCAT('finance-unique-code-v1:', reconciliation.`orderId`),
  CASE
    WHEN reconciliation.`desiredAvailable` + reconciliation.`desiredHeld`
      < reconciliation.`currentAvailable` + reconciliation.`currentHeld` THEN 'ORDER_REFUND'
    WHEN reconciliation.`desiredAvailable` > reconciliation.`currentAvailable` THEN 'ORDER_AVAILABLE'
    WHEN reconciliation.`desiredAvailable` = 0 AND reconciliation.`desiredHeld` = 0 THEN 'ORDER_RELEASE'
    ELSE 'ORDER_HOLD'
  END,
  reconciliation.`desiredAvailable` - reconciliation.`currentAvailable`,
  reconciliation.`desiredHeld` - reconciliation.`currentHeld`,
  reconciliation.`grossAmount`,
  reconciliation.`productSubtotal`,
  reconciliation.`shippingFee`,
  reconciliation.`serviceFee`,
  reconciliation.`qrisFee`,
  reconciliation.`uniqueCode`,
  reconciliation.`discountAmount`,
  reconciliation.`remainingNet`,
  'Rekonsiliasi omzet: produk setelah diskon + ongkir + kode unik - refund',
  'migration',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `_RevenueUniqueCodeReconcile20260722` reconciliation
WHERE reconciliation.`desiredAvailable` <> reconciliation.`currentAvailable`
   OR reconciliation.`desiredHeld` <> reconciliation.`currentHeld`;

DROP TEMPORARY TABLE `_RevenueUniqueCodeReconcile20260722`;
