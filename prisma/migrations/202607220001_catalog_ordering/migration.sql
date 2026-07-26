ALTER TABLE `Product`
  ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `ProductCategory`
  ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0;

SET @product_position := 0;
UPDATE `Product`
SET `position` = (@product_position := @product_position + 1)
ORDER BY `createdAt` ASC, `id` ASC;

SET @category_position := 0;
UPDATE `ProductCategory`
SET `position` = (@category_position := @category_position + 1)
ORDER BY `createdAt` ASC, `id` ASC;

CREATE INDEX `Product_status_position_id_idx` ON `Product`(`status`, `position`, `id`);
CREATE INDEX `ProductCategory_position_id_idx` ON `ProductCategory`(`position`, `id`);
