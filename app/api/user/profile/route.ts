import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(20).regex(/^[0-9+() -]+$/),
});

export async function PUT(request: Request) {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data profil tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: customer.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
      },
    });

    return NextResponse.json({ success: true, user: { name: updated.name, phone: updated.phone } });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}
