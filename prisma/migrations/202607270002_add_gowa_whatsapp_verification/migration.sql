-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `phoneVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `WhatsappOtpChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('PHONE_VERIFICATION', 'REFUND_SETTING_VERIFICATION') NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `bindingHash` VARCHAR(64) NOT NULL,
    `resendCount` INTEGER NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `invalidatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WhatsappOtpChallenge_userId_purpose_createdAt_idx`(`userId`, `purpose`, `createdAt`),
    INDEX `WhatsappOtpChallenge_phone_createdAt_idx`(`phone`, `createdAt`),
    INDEX `WhatsappOtpChallenge_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsappMessage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `phone` VARCHAR(40) NOT NULL,
    `kind` VARCHAR(50) NOT NULL,
    `sourceType` VARCHAR(50) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `dedupeKey` VARCHAR(220) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'AMBIGUOUS') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `providerMessageId` VARCHAR(191) NULL,
    `providerCode` VARCHAR(80) NULL,
    `httpStatus` INTEGER NULL,
    `error` TEXT NULL,
    `lastAttemptAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WhatsappMessage_dedupeKey_key`(`dedupeKey`),
    INDEX `WhatsappMessage_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `WhatsappMessage_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `WhatsappMessage_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WhatsappOtpChallenge`
    ADD CONSTRAINT `WhatsappOtpChallenge_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsappMessage`
    ADD CONSTRAINT `WhatsappMessage_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsappMessage`
    ADD CONSTRAINT `WhatsappMessage_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
