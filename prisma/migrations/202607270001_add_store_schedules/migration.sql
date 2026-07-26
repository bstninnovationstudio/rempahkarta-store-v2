-- CreateTable
CREATE TABLE `StoreSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('HOLIDAY', 'MAINTENANCE') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `announcement` TEXT NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` ENUM('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `createdBy` VARCHAR(200) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StoreSchedule_status_startAt_endAt_idx`(`status`, `startAt`, `endAt`),
    INDEX `StoreSchedule_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
