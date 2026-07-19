-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(100) NULL,
    `categoryId` VARCHAR(191) NULL,
    `hasVariants` BOOLEAN NOT NULL DEFAULT false,
    `option1Name` VARCHAR(80) NULL,
    `option2Name` VARCHAR(80) NULL,
    `seoTitle` VARCHAR(180) NULL,
    `seoDescription` VARCHAR(320) NULL,
    `shopeeLink` VARCHAR(500) NULL,
    `tiktokLink` VARCHAR(500) NULL,
    `tokopediaLink` VARCHAR(500) NULL,
    `rating` DOUBLE NOT NULL DEFAULT 0.0,
    `sold` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_categoryId_status_idx`(`categoryId`, `status`),
    INDEX `Product_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductCategory` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductCategory_slug_key`(`slug`),
    UNIQUE INDEX `ProductCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(80) NOT NULL,
    `barcode` VARCHAR(80) NULL,
    `name` VARCHAR(180) NOT NULL,
    `option1Value` VARCHAR(80) NULL,
    `option2Value` VARCHAR(80) NULL,
    `color` VARCHAR(80) NULL,
    `size` VARCHAR(40) NULL,
    `price` BIGINT NOT NULL,
    `compareAt` BIGINT NULL,
    `weight` INTEGER NOT NULL,
    `length` INTEGER NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `insuranceValue` BIGINT NULL,
    `lowStockThreshold` INTEGER NOT NULL DEFAULT 5,
    `position` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `imageKey` VARCHAR(500) NULL,

    UNIQUE INDEX `ProductVariant_sku_key`(`sku`),
    UNIQUE INDEX `ProductVariant_barcode_key`(`barcode`),
    INDEX `ProductVariant_productId_active_position_idx`(`productId`, `active`, `position`),
    INDEX `ProductVariant_productId_option1Value_option2Value_idx`(`productId`, `option1Value`, `option2Value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `objectKey` VARCHAR(500) NOT NULL,
    `alt` VARCHAR(255) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `primary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `ProductImage_productId_position_idx`(`productId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Warehouse` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `contactName` VARCHAR(160) NOT NULL,
    `contactPhone` VARCHAR(40) NOT NULL,
    `address` TEXT NOT NULL,
    `postalCode` VARCHAR(10) NOT NULL,
    `areaId` VARCHAR(120) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryLevel` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `onHand` INTEGER NOT NULL DEFAULT 0,
    `reserved` INTEGER NOT NULL DEFAULT 0,
    `safetyStock` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `InventoryLevel_variantId_warehouseId_key`(`variantId`, `warehouseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `quantityDelta` INTEGER NOT NULL,
    `referenceType` VARCHAR(40) NULL,
    `referenceId` VARCHAR(120) NULL,
    `reason` VARCHAR(255) NULL,
    `actorId` VARCHAR(120) NULL,
    `dedupeKey` VARCHAR(220) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InventoryMovement_dedupeKey_key`(`dedupeKey`),
    INDEX `InventoryMovement_variantId_createdAt_idx`(`variantId`, `createdAt`),
    INDEX `InventoryMovement_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `publicNumber` VARCHAR(40) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestName` VARCHAR(160) NOT NULL,
    `guestEmail` VARCHAR(200) NOT NULL,
    `guestPhone` VARCHAR(40) NOT NULL,
    `accessTokenHash` VARCHAR(128) NOT NULL,
    `policyVersion` VARCHAR(30) NOT NULL DEFAULT '2026-07',
    `policyAcceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currency` VARCHAR(3) NOT NULL DEFAULT 'IDR',
    `subtotal` BIGINT NOT NULL,
    `shippingFee` BIGINT NOT NULL,
    `grandTotal` BIGINT NOT NULL,
    `paymentState` ENUM('not_created', 'pending', 'paid', 'expired', 'canceled', 'failed', 'denied', 'refund_pending', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'not_created',
    `fulfillmentState` ENUM('awaiting_payment', 'awaiting_processing', 'processing', 'packed', 'shipment_booked', 'handover_pending', 'handed_over', 'completed', 'cancel_requested', 'cancelled', 'return_requested', 'return_in_transit', 'returned', 'finished') NOT NULL DEFAULT 'awaiting_payment',
    `issueOrder` BOOLEAN NOT NULL DEFAULT false,
    `issueReason` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_publicNumber_key`(`publicNumber`),
    INDEX `Order_paymentState_createdAt_idx`(`paymentState`, `createdAt`),
    INDEX `Order_fulfillmentState_createdAt_idx`(`fulfillmentState`, `createdAt`),
    INDEX `Order_guestEmail_createdAt_idx`(`guestEmail`, `createdAt`),
    INDEX `Order_issueOrder_fulfillmentState_idx`(`issueOrder`, `fulfillmentState`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    INDEX `Order_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Order_userId_paymentState_createdAt_idx`(`userId`, `paymentState`, `createdAt`),
    INDEX `Order_guestEmail_paymentState_createdAt_idx`(`guestEmail`, `paymentState`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `skuSnapshot` VARCHAR(80) NOT NULL,
    `nameSnapshot` VARCHAR(180) NOT NULL,
    `optionsSnapshot` JSON NOT NULL,
    `unitPrice` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL,
    `weight` INTEGER NOT NULL,
    `length` INTEGER NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderAddress` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `contactName` VARCHAR(160) NOT NULL,
    `contactPhone` VARCHAR(40) NOT NULL,
    `contactEmail` VARCHAR(200) NULL,
    `address` TEXT NOT NULL,
    `note` VARCHAR(255) NULL,
    `postalCode` VARCHAR(10) NOT NULL,
    `areaId` VARCHAR(120) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,

    INDEX `OrderAddress_orderId_type_idx`(`orderId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(40) NOT NULL DEFAULT 'bstn',
    `providerPaymentId` VARCHAR(120) NULL,
    `projectPaymentRef` VARCHAR(100) NOT NULL,
    `amount` BIGINT NOT NULL,
    `payableAmount` BIGINT NULL,
    `feeAmount` BIGINT NULL,
    `status` ENUM('not_created', 'pending', 'paid', 'expired', 'canceled', 'failed', 'denied', 'refund_pending', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'not_created',
    `paymentPageUrl` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_providerPaymentId_key`(`providerPaymentId`),
    UNIQUE INDEX `Payment_projectPaymentRef_key`(`projectPaymentRef`),
    INDEX `Payment_orderId_status_idx`(`orderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(160) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `payload` JSON NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentEvent_providerEventId_key`(`providerEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingQuote` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `courierCompany` VARCHAR(40) NOT NULL,
    `courierType` VARCHAR(60) NOT NULL,
    `courierName` VARCHAR(100) NOT NULL,
    `price` BIGINT NOT NULL,
    `etaText` VARCHAR(120) NULL,
    `collectionMethods` JSON NULL,
    `request` JSON NOT NULL,
    `response` JSON NOT NULL,
    `selectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShippingQuote_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shipment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `providerOrderId` VARCHAR(120) NULL,
    `referenceId` VARCHAR(120) NOT NULL,
    `trackingId` VARCHAR(120) NULL,
    `waybillId` VARCHAR(120) NULL,
    `courierCompany` VARCHAR(40) NOT NULL,
    `courierType` VARCHAR(60) NOT NULL,
    `collectionMethod` VARCHAR(20) NOT NULL,
    `quotedPrice` BIGINT NOT NULL,
    `actualPrice` BIGINT NULL,
    `priceAdjustment` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'confirmed',
    `waybillUpdatedAt` DATETIME(3) NULL,
    `lastProviderSyncAt` DATETIME(3) NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Shipment_providerOrderId_key`(`providerOrderId`),
    UNIQUE INDEX `Shipment_referenceId_key`(`referenceId`),
    UNIQUE INDEX `Shipment_trackingId_key`(`trackingId`),
    INDEX `Shipment_orderId_status_idx`(`orderId`, `status`),
    INDEX `Shipment_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentTrackingEvent` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `providerStatus` VARCHAR(50) NOT NULL,
    `note` TEXT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `payloadHash` VARCHAR(128) NOT NULL,
    `payload` JSON NOT NULL,

    INDEX `ShipmentTrackingEvent_shipmentId_occurredAt_idx`(`shipmentId`, `occurredAt`),
    UNIQUE INDEX `ShipmentTrackingEvent_shipmentId_payloadHash_key`(`shipmentId`, `payloadHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnRequest` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `publicNumber` VARCHAR(40) NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'buyer',
    `cause` VARCHAR(80) NULL,
    `reason` VARCHAR(80) NOT NULL,
    `description` TEXT NOT NULL,
    `evidence` JSON NULL,
    `state` ENUM('requested', 'under_review', 'rejected', 'approved', 'awaiting_handover', 'in_transit', 'received', 'inspection_passed', 'inspection_failed', 'refund_pending', 'refunded', 'closed', 'awaiting_approval', 'waiting_waybill', 'processing_return', 'return_complete', 'processing_refund', 'cancelled', 'finished') NOT NULL DEFAULT 'requested',
    `decisionReason` TEXT NULL,
    `refundAmount` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReturnRequest_publicNumber_key`(`publicNumber`),
    INDEX `ReturnRequest_state_createdAt_idx`(`state`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `inspection` VARCHAR(40) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CancellationRequest` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `state` ENUM('requested', 'approved', 'rejected', 'provider_pending', 'provider_failed') NOT NULL DEFAULT 'requested',
    `fulfillmentBefore` ENUM('awaiting_payment', 'awaiting_processing', 'processing', 'packed', 'shipment_booked', 'handover_pending', 'handed_over', 'completed', 'cancel_requested', 'cancelled', 'return_requested', 'return_in_transit', 'returned', 'finished') NOT NULL,
    `decisionReason` TEXT NULL,
    `providerResult` JSON NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `decidedBy` VARCHAR(120) NULL,

    INDEX `CancellationRequest_state_requestedAt_idx`(`state`, `requestedAt`),
    INDEX `CancellationRequest_orderId_requestedAt_idx`(`orderId`, `requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Refund` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NULL,
    `amount` BIGINT NOT NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `method` VARCHAR(80) NULL,
    `reference` VARCHAR(160) NULL,
    `proofObjectKey` VARCHAR(500) NULL,
    `processedBy` VARCHAR(120) NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Refund_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookInbox` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(40) NOT NULL,
    `deliveryKey` VARCHAR(180) NOT NULL,
    `signatureValid` BOOLEAN NOT NULL DEFAULT false,
    `payloadHash` VARCHAR(128) NOT NULL,
    `headers` JSON NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'received',
    `error` TEXT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `WebhookInbox_status_receivedAt_idx`(`status`, `receivedAt`),
    UNIQUE INDEX `WebhookInbox_source_deliveryKey_key`(`source`, `deliveryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(40) NOT NULL,
    `actorId` VARCHAR(120) NULL,
    `action` VARCHAR(120) NOT NULL,
    `entityType` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(120) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ipHash` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(200) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `googleId` VARCHAR(120) NOT NULL,
    `currentSessionId` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    INDEX `User_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAddress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `contactName` VARCHAR(160) NOT NULL,
    `contactPhone` VARCHAR(40) NOT NULL,
    `contactEmail` VARCHAR(200) NOT NULL,
    `address` TEXT NOT NULL,
    `postalCode` VARCHAR(10) NOT NULL,
    `areaId` VARCHAR(120) NOT NULL,

    INDEX `UserAddress_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRefundSetting` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `bankName` VARCHAR(100) NULL,
    `bankOwnerName` VARCHAR(160) NULL,
    `bankNumber` VARCHAR(80) NULL,
    `ewalletName` VARCHAR(100) NULL,
    `ewalletOwnerName` VARCHAR(160) NULL,
    `ewalletNumber` VARCHAR(80) NULL,

    UNIQUE INDEX `UserRefundSetting_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CartItem_userId_idx`(`userId`),
    UNIQUE INDEX `CartItem_userId_variantId_key`(`userId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLevel` ADD CONSTRAINT `InventoryLevel_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLevel` ADD CONSTRAINT `InventoryLevel_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderAddress` ADD CONSTRAINT `OrderAddress_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingQuote` ADD CONSTRAINT `ShippingQuote_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentTrackingEvent` ADD CONSTRAINT `ShipmentTrackingEvent_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnRequest` ADD CONSTRAINT `ReturnRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnItem` ADD CONSTRAINT `ReturnItem_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `ReturnRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnItem` ADD CONSTRAINT `ReturnItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CancellationRequest` ADD CONSTRAINT `CancellationRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `ReturnRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAddress` ADD CONSTRAINT `UserAddress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRefundSetting` ADD CONSTRAINT `UserRefundSetting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
