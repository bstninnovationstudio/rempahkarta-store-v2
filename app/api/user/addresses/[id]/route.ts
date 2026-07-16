import { NextResponse } from "next/server";
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.userAddress.findFirst({
      where: { id, userId: customer.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alamat tidak ditemukan" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data alamat tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.userAddress.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memperbarui alamat" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.userAddress.findFirst({
      where: { id, userId: customer.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alamat tidak ditemukan" }, { status: 404 });
    }

    await prisma.userAddress.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menghapus alamat" }, { status: 500 });
  }
}
