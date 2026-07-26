import { prisma } from "../lib/db.js";

async function verifyState() {
  console.log("=== DATABASE STATE VERIFICATION ===");

  const counts = {
    users: await prisma.user.count(),
    userAddresses: await prisma.userAddress.count(),
    userRefundSettings: await prisma.userRefundSetting.count(),
    cartItems: await prisma.cartItem.count(),
    products: await prisma.product.count(),
    productCategories: await prisma.productCategory.count(),
    productVariants: await prisma.productVariant.count(),
    productImages: await prisma.productImage.count(),
    warehouses: await prisma.warehouse.count(),
    inventoryLevels: await prisma.inventoryLevel.count(),
    vouchers: await prisma.voucher.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    payments: await prisma.payment.count(),
    shipments: await prisma.shipment.count(),
    returns: await prisma.returnRequest.count(),
    cancellations: await prisma.cancellationRequest.count(),
    refunds: await prisma.refund.count(),
    inventoryMovements: await prisma.inventoryMovement.count(),
    revenueLedgers: await prisma.revenueLedger.count(),
    biteshipLedgers: await prisma.biteshipLedger.count(),
    webhookInboxes: await prisma.webhookInbox.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log("Preserved Data:");
  console.log(`- Users: ${counts.users}`);
  console.log(`- User Addresses: ${counts.userAddresses}`);
  console.log(`- User Refund Settings: ${counts.userRefundSettings}`);
  console.log(`- Cart Items: ${counts.cartItems}`);
  console.log(`- Products: ${counts.products}`);
  console.log(`- Product Categories: ${counts.productCategories}`);
  console.log(`- Product Variants: ${counts.productVariants}`);
  console.log(`- Product Images: ${counts.productImages}`);
  console.log(`- Warehouses: ${counts.warehouses}`);
  console.log(`- Inventory Levels: ${counts.inventoryLevels}`);
  console.log(`- Vouchers: ${counts.vouchers}`);

  console.log("\nCleared Data (should all be 0):");
  console.log(`- Orders: ${counts.orders}`);
  console.log(`- Order Items: ${counts.orderItems}`);
  console.log(`- Payments: ${counts.payments}`);
  console.log(`- Shipments: ${counts.shipments}`);
  console.log(`- Return Requests: ${counts.returns}`);
  console.log(`- Cancellation Requests: ${counts.cancellations}`);
  console.log(`- Refunds: ${counts.refunds}`);
  console.log(`- Inventory Movements: ${counts.inventoryMovements}`);
  console.log(`- Revenue Ledgers: ${counts.revenueLedgers}`);
  console.log(`- Biteship Ledgers: ${counts.biteshipLedgers}`);
  console.log(`- Webhook Inboxes: ${counts.webhookInboxes}`);
  console.log(`- Audit Logs: ${counts.auditLogs}`);
}

verifyState()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
