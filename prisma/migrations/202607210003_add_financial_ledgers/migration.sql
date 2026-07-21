CREATE TABLE `RevenueLedger` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `dedupeKey` VARCHAR(220) NOT NULL,
  `type` ENUM('ORDER_HOLD', 'ORDER_AVAILABLE', 'ORDER_RELEASE', 'ORDER_REFUND', 'WITHDRAWAL', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT') NOT NULL,
  `availableDelta` BIGINT NOT NULL DEFAULT 0,
  `heldDelta` BIGINT NOT NULL DEFAULT 0,
  `grossAmount` BIGINT NOT NULL DEFAULT 0,
  `shippingFee` BIGINT NOT NULL DEFAULT 0,
  `serviceFee` BIGINT NOT NULL DEFAULT 0,
  `adminFee` BIGINT NOT NULL DEFAULT 0,
  `discountAmount` BIGINT NOT NULL DEFAULT 0,
  `netAmount` BIGINT NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NULL,
  `actorId` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `RevenueLedger_dedupeKey_key`(`dedupeKey`),
  INDEX `RevenueLedger_type_createdAt_idx`(`type`, `createdAt`),
  INDEX `RevenueLedger_orderId_createdAt_idx`(`orderId`, `createdAt`),
  INDEX `RevenueLedger_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RevenueLedger_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BiteshipFundAccount` (
  `id` VARCHAR(30) NOT NULL DEFAULT 'primary',
  `balance` BIGINT NOT NULL DEFAULT 0,
  `areaSearchCost` BIGINT NOT NULL DEFAULT 0,
  `rateQuoteCost` BIGINT NOT NULL DEFAULT 0,
  `trackingCheckCost` BIGINT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BiteshipLedger` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('TOP_UP', 'DEDUCT_MANUAL', 'USAGE_AREA', 'USAGE_RATE', 'USAGE_SHIPMENT', 'USAGE_TRACKING', 'REVERSAL') NOT NULL,
  `amount` BIGINT NOT NULL,
  `referenceId` VARCHAR(160) NULL,
  `dedupeKey` VARCHAR(220) NULL,
  `notes` VARCHAR(500) NULL,
  `actorId` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BiteshipLedger_dedupeKey_key`(`dedupeKey`),
  INDEX `BiteshipLedger_type_createdAt_idx`(`type`, `createdAt`),
  INDEX `BiteshipLedger_referenceId_createdAt_idx`(`referenceId`, `createdAt`),
  INDEX `BiteshipLedger_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `BiteshipFundAccount` (`id`, `balance`, `areaSearchCost`, `rateQuoteCost`, `trackingCheckCost`, `createdAt`, `updatedAt`)
VALUES ('primary', 0, 0, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `RevenueLedger` (
  `id`, `orderId`, `dedupeKey`, `type`, `availableDelta`, `heldDelta`,
  `grossAmount`, `shippingFee`, `serviceFee`, `adminFee`, `discountAmount`, `netAmount`,
  `notes`, `actorId`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('rev_', LEFT(REPLACE(UUID(), '-', ''), 24)),
  o.`id`,
  CONCAT('finance-backfill:', o.`id`),
  CASE
    WHEN o.`paymentState` IN ('paid', 'partially_refunded')
      AND o.`fulfillmentState` IN ('completed', 'finished')
      AND o.`issueOrder` = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM `ReturnRequest` rr
        WHERE rr.`orderId` = o.`id`
          AND rr.`state` NOT IN ('rejected', 'cancelled', 'closed', 'finished', 'refunded')
      )
      AND NOT EXISTS (
        SELECT 1 FROM `CancellationRequest` cr
        WHERE cr.`orderId` = o.`id`
          AND cr.`state` IN ('requested', 'approved', 'provider_pending', 'provider_failed')
      )
    THEN 'ORDER_AVAILABLE'
    ELSE 'ORDER_HOLD'
  END,
  CASE
    WHEN o.`paymentState` IN ('paid', 'partially_refunded')
      AND o.`fulfillmentState` IN ('completed', 'finished')
      AND o.`issueOrder` = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM `ReturnRequest` rr
        WHERE rr.`orderId` = o.`id`
          AND rr.`state` NOT IN ('rejected', 'cancelled', 'closed', 'finished', 'refunded')
      )
      AND NOT EXISTS (
        SELECT 1 FROM `CancellationRequest` cr
        WHERE cr.`orderId` = o.`id`
          AND cr.`state` IN ('requested', 'approved', 'provider_pending', 'provider_failed')
      )
    THEN GREATEST(0, o.`subtotal` - o.`discountAmount` - COALESCE((SELECT SUM(r.`amount`) FROM `Refund` r WHERE r.`orderId` = o.`id` AND r.`status` = 'completed'), 0))
    ELSE 0
  END,
  CASE
    WHEN o.`paymentState` IN ('paid', 'partially_refunded')
      AND o.`fulfillmentState` IN ('completed', 'finished')
      AND o.`issueOrder` = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM `ReturnRequest` rr
        WHERE rr.`orderId` = o.`id`
          AND rr.`state` NOT IN ('rejected', 'cancelled', 'closed', 'finished', 'refunded')
      )
      AND NOT EXISTS (
        SELECT 1 FROM `CancellationRequest` cr
        WHERE cr.`orderId` = o.`id`
          AND cr.`state` IN ('requested', 'approved', 'provider_pending', 'provider_failed')
      )
    THEN 0
    ELSE GREATEST(0, o.`subtotal` - o.`discountAmount` - COALESCE((SELECT SUM(r.`amount`) FROM `Refund` r WHERE r.`orderId` = o.`id` AND r.`status` = 'completed'), 0))
  END,
  o.`grandTotal`, o.`shippingFee`, o.`serviceFee`, COALESCE(p.`feeAmount`, 0), o.`discountAmount`,
  GREATEST(0, o.`subtotal` - o.`discountAmount` - COALESCE((SELECT SUM(r.`amount`) FROM `Refund` r WHERE r.`orderId` = o.`id` AND r.`status` = 'completed'), 0)),
  'Backfill migration ledger keuangan', 'migration', o.`createdAt`, CURRENT_TIMESTAMP(3)
FROM `Order` o
LEFT JOIN `Payment` p ON p.`id` = (
  SELECT p2.`id` FROM `Payment` p2 WHERE p2.`orderId` = o.`id` ORDER BY p2.`createdAt` DESC LIMIT 1
)
WHERE o.`paymentState` IN ('paid', 'refund_pending', 'partially_refunded')
  AND GREATEST(0, o.`subtotal` - o.`discountAmount` - COALESCE((SELECT SUM(r.`amount`) FROM `Refund` r WHERE r.`orderId` = o.`id` AND r.`status` = 'completed'), 0)) > 0;
