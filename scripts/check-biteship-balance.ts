import { prisma } from "../lib/db.js";
import { getBiteshipStats } from "../lib/finance.js";

async function main() {
  const stats = await getBiteshipStats();
  console.log("BITESHIP_ACCOUNT_INFO:", JSON.stringify({
    balance: stats.account.balance.toString(),
    areaSearchCost: stats.account.areaSearchCost.toString(),
    rateQuoteCost: stats.account.rateQuoteCost.toString(),
    trackingCheckCost: stats.account.trackingCheckCost.toString(),
    totalAdded: stats.totalAdded.toString(),
    totalUsed: stats.totalUsed.toString(),
    transactionCount: stats.transactionCount,
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
