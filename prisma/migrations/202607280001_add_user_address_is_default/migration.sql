-- AlterTable
ALTER TABLE `UserAddress` ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `UserAddress_userId_isDefault_idx` ON `UserAddress`(`userId`, `isDefault`);
