import { NextResponse } from "next/server";
import { customerCookie, customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const customer = await customerFromRequest();
  if (customer?.currentSessionId) {
    try {
      await prisma.user.updateMany({
        where: { id: customer.id, currentSessionId: customer.currentSessionId },
        data: { currentSessionId: null },
      });
    } catch {
      // Cookie tetap dihapus agar pengguna dapat mengakhiri sesi lokal saat DB terganggu.
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(customerCookie.name, "", { ...customerCookie.options, maxAge: 0 });
  return response;
}
