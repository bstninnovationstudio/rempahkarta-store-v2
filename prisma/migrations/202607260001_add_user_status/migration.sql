-- AlterTable
ALTER TABLE `User` ADD COLUMN `status` ENUM('ACTIVE', 'PAUSE', 'BLOCK') NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);
