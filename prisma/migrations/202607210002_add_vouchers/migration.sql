CREATE TABLE `Voucher` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `code` VARCHAR(50) NOT NULL,
  `status` ENUM('ACTIVE', 'PAUSE', 'FINISH') NOT NULL DEFAULT 'ACTIVE',
  `available` ENUM('public', 'private') NOT NULL DEFAULT 'public',
  `mode` ENUM('NOMINAL', 'PERCENTAGE') NOT NULL DEFAULT 'NOMINAL',
  `discountValue` BIGINT NOT NULL,
  `minPurchase` BIGINT NULL,
  `maxDiscount` BIGINT NULL,
  `dailyLimit` INTEGER NULL,
  `totalLimit` INTEGER NULL,
  `userLimit` INTEGER NULL,
  `totalUsage` INTEGER NOT NULL DEFAULT 0,
  `startAt` DATETIME(3) NULL,
  `endAt` DATETIME(3) NULL,
  `target` ENUM('TOTAL', 'PRODUCT_SUBTOTAL', 'SHIPPING') NOT NULL DEFAULT 'TOTAL',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Voucher_code_key`(`code`),
  INDEX `Voucher_status_available_code_idx`(`status`, `available`, `code`),
  INDEX `Voucher_endAt_status_idx`(`endAt`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Order`
  ADD COLUMN `voucherId` VARCHAR(191) NULL,
  ADD COLUMN `voucherCode` VARCHAR(50) NULL,
  ADD COLUMN `discountAmount` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `voucherTarget` ENUM('TOTAL', 'PRODUCT_SUBTOTAL', 'SHIPPING') NULL,
  ADD INDEX `Order_voucherId_idx`(`voucherId`);

CREATE TABLE `VoucherUsage` (
  `id` VARCHAR(191) NOT NULL,
  `voucherId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `discountAmount` BIGINT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VoucherUsage_orderId_key`(`orderId`),
  INDEX `VoucherUsage_voucherId_userId_idx`(`voucherId`, `userId`),
  INDEX `VoucherUsage_voucherId_createdAt_idx`(`voucherId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VoucherUsage_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VoucherUsage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VoucherUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Order` ADD CONSTRAINT `Order_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
