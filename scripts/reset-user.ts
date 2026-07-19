import { prisma } from "../lib/db";

async function main() {
  const email = process.argv[2] || "bestuana1@gmail.com";
  
  console.log(`Mencari user dengan email: ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      orders: true,
      addresses: true,
      refundSetting: true,
      cartItems: true,
    }
  });

  if (!user) {
    console.log(`User dengan email ${email} tidak ditemukan di database.`);
    return;
  }

  console.log(`User ditemukan:`);
  console.log(`- ID: ${user.id}`);
  console.log(`- Nama: ${user.name}`);
  console.log(`- Jumlah Alamat: ${user.addresses.length}`);
  console.log(`- Rekening Refund: ${user.refundSetting ? "Ada" : "Tidak ada"}`);
  console.log(`- Jumlah Item Keranjang: ${user.cartItems.length}`);
  console.log(`- Jumlah Pesanan: ${user.orders.length} (ID order akan diset ke null setelah user dihapus)`);

  console.log(`Menghapus user dan data terkait (alamat, rekening refund, keranjang)...`);
  
  await prisma.user.delete({
    where: { id: user.id }
  });

  console.log(`Berhasil menghapus user ${email} dari database.`);
}

main()
  .catch((err) => {
    console.error("Terjadi error saat menghapus user:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
