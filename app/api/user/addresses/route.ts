import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";

const addressSchema = z.object({
  label: z.string().trim().min(1).max(80),
  contactName: z.string().trim().min(2).max(160),
  contactPhone: z.string().trim().min(8).max(20).regex(/^[0-9+() -]+$/),
  contactEmail: z.string().trim().email().max(200),
  address: z.string().trim().min(10).max(1000),
  postalCode: z.string().regex(/^\d{5}$/),
  areaId: z.string().min(3).max(120),
});

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const addresses = await prisma.userAddress.findMany({
      where: { userId: customer.id },
    });
    return NextResponse.json({ success: true, addresses });
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil daftar alamat" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data alamat tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }

    // Gunakan transaction untuk mencegah race condition agar jumlah alamat tidak melebihi 5
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.userAddress.count({
        where: { userId: customer.id },
      });

      if (count >= 5) {
        throw new Error("Maksimal alamat tersimpan adalah 5");
      }

      const address = await tx.userAddress.create({
        data: {
          userId: customer.id,
          ...parsed.data,
        },
      });

      return address;
    });

    return NextResponse.json({ success: true, address: result });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Gagal menyimpan alamat baru") }, { status: 400 });
  }
}
