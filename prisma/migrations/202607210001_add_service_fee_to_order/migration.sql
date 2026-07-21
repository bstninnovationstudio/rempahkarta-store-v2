-- Additive, idempotent migration to add serviceFee column to Order table.

SET @order_service_fee_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'Order'
    AND column_name = 'serviceFee'
);
SET @order_service_fee_sql = IF(
  @order_service_fee_exists = 0,
  'ALTER TABLE `Order` ADD COLUMN `serviceFee` BIGINT NOT NULL DEFAULT 0 AFTER `shippingFee`',
  'SELECT 1'
);
PREPARE order_service_fee_stmt FROM @order_service_fee_sql;
EXECUTE order_service_fee_stmt;
DEALLOCATE PREPARE order_service_fee_stmt;
