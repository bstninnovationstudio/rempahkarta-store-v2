-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `whatsappShipmentNotifications` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsappShipmentConsentedAt` DATETIME(3) NULL,
    ADD COLUMN `whatsappPromotionNotifications` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsappPromotionConsentedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `WhatsappPromotionCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `mediaFileName` VARCHAR(191) NULL,
    `mediaContentType` VARCHAR(80) NULL,
    `status` ENUM('QUEUED', 'SENDING', 'COMPLETED') NOT NULL DEFAULT 'QUEUED',
    `totalRecipients` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `ambiguousCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(200) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WhatsappPromotionCampaign_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `WhatsappPromotionCampaign_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `WhatsappMessage`
    ADD COLUMN `campaignId` VARCHAR(191) NULL,
    MODIFY COLUMN `status` ENUM('PENDING', 'SENT', 'FAILED', 'AMBIGUOUS', 'SKIPPED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `WhatsappMessage_campaignId_status_idx`
    ON `WhatsappMessage`(`campaignId`, `status`);

-- AddForeignKey
ALTER TABLE `WhatsappMessage`
    ADD CONSTRAINT `WhatsappMessage_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `WhatsappPromotionCampaign`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
