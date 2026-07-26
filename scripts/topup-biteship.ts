import { prisma } from "../lib/db.js";

async function main() {
  const account = await prisma.biteshipFundAccount.upsert({
    where: { id: "primary" },
    update: { balance: BigInt(100000000) },
    create: { id: "primary", balance: BigInt(100000000) },
  });

  console.log("Updated BiteshipFundAccount:", account);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
