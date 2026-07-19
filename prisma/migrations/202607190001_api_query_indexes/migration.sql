-- Additive, idempotent indexes for the current production schema.
-- This migration does not delete, rewrite, or seed application data.

SET @product_status_updated_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'Product'
    AND index_name = 'Product_status_updatedAt_idx'
);
SET @product_status_updated_sql = IF(
  @product_status_updated_exists = 0,
  'CREATE INDEX `Product_status_updatedAt_idx` ON `Product` (`status`, `updatedAt`)',
  'SELECT 1'
);
PREPARE product_status_updated_stmt FROM @product_status_updated_sql;
EXECUTE product_status_updated_stmt;
DEALLOCATE PREPARE product_status_updated_stmt;

SET @order_user_payment_created_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'Order'
    AND index_name = 'Order_userId_paymentState_createdAt_idx'
);
SET @order_user_payment_created_sql = IF(
  @order_user_payment_created_exists = 0,
  'CREATE INDEX `Order_userId_paymentState_createdAt_idx` ON `Order` (`userId`, `paymentState`, `createdAt`)',
  'SELECT 1'
);
PREPARE order_user_payment_created_stmt FROM @order_user_payment_created_sql;
EXECUTE order_user_payment_created_stmt;
DEALLOCATE PREPARE order_user_payment_created_stmt;

SET @order_email_payment_created_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'Order'
    AND index_name = 'Order_guestEmail_paymentState_createdAt_idx'
);
SET @order_email_payment_created_sql = IF(
  @order_email_payment_created_exists = 0,
  'CREATE INDEX `Order_guestEmail_paymentState_createdAt_idx` ON `Order` (`guestEmail`, `paymentState`, `createdAt`)',
  'SELECT 1'
);
PREPARE order_email_payment_created_stmt FROM @order_email_payment_created_sql;
EXECUTE order_email_payment_created_stmt;
DEALLOCATE PREPARE order_email_payment_created_stmt;

SET @order_created_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'Order'
    AND index_name = 'Order_createdAt_idx'
);
SET @order_created_sql = IF(
  @order_created_exists = 0,
  'CREATE INDEX `Order_createdAt_idx` ON `Order` (`createdAt`)',
  'SELECT 1'
);
PREPARE order_created_stmt FROM @order_created_sql;
EXECUTE order_created_stmt;
DEALLOCATE PREPARE order_created_stmt;

SET @user_created_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'User'
    AND index_name = 'User_createdAt_idx'
);
SET @user_created_sql = IF(
  @user_created_exists = 0,
  'CREATE INDEX `User_createdAt_idx` ON `User` (`createdAt`)',
  'SELECT 1'
);
PREPARE user_created_stmt FROM @user_created_sql;
EXECUTE user_created_stmt;
DEALLOCATE PREPARE user_created_stmt;

SET @audit_created_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'AuditLog'
    AND index_name = 'AuditLog_createdAt_idx'
);
SET @audit_created_sql = IF(
  @audit_created_exists = 0,
  'CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog` (`createdAt`)',
  'SELECT 1'
);
PREPARE audit_created_stmt FROM @audit_created_sql;
EXECUTE audit_created_stmt;
DEALLOCATE PREPARE audit_created_stmt;
