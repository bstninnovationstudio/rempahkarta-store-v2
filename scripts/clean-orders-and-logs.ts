import { prisma } from "../lib/db.js";

async function cleanOrdersAndLogs() {
  console.log("Starting cleanup of orders and transaction logs...");

  await prisma.$transaction(async (tx) => {
    // Disable foreign key checks for clean truncation
    await tx.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);

    // Delete transaction and order related tables
    const tablesToDelete = [
      "Refund",
      "ReturnItem",
      "ReturnRequest",
      "CancellationRequest",
      "ShipmentTrackingEvent",
      "Shipment",
      "ShippingQuote",
      "PaymentEvent",
      "Payment",
      "OrderAddress",
      "OrderItem",
      "VoucherUsage",
      "RevenueLedger",
      "Order",
      "InventoryMovement",
      "BiteshipLedger",
      "WebhookInbox",
      "AuditLog",
    ];

    for (const table of tablesToDelete) {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
      console.log(`- Truncated table: ${table}`);
    }

    // Reset stats & counts on preserved catalog/inventory/voucher tables
    await tx.$executeRawUnsafe(`UPDATE \`Product\` SET \`sold\` = 0;`);
    console.log("- Reset Product.sold = 0");

    await tx.$executeRawUnsafe(`UPDATE \`InventoryLevel\` SET \`reserved\` = 0;`);
    console.log("- Reset InventoryLevel.reserved = 0");

    await tx.$executeRawUnsafe(`UPDATE \`Voucher\` SET \`totalUsage\` = 0;`);
    console.log("- Reset Voucher.totalUsage = 0");

    await tx.$executeRawUnsafe(
      `UPDATE \`BiteshipFundAccount\` SET \`balance\` = 0, \`areaSearchCost\` = 0, \`rateQuoteCost\` = 0, \`trackingCheckCost\` = 0;`
    );
    console.log("- Reset BiteshipFundAccount balance & costs to 0");

    // Re-enable foreign key checks
    await tx.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
  }, {
    timeout: 30000,
  });

  console.log("Cleanup completed successfully!");
}

cleanOrdersAndLogs()
  .catch((err) => {
    console.error("Error during cleanup:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
