import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveLocalImage } from "@/lib/local-media";
import { sha256 } from "@/lib/security";
import { customerFromRequest } from "@/lib/customer-auth";

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await request.formData();
  const file = data.get("file");
  const { number } = await params;
  const order = await prisma.order.findUnique({ where: { publicNumber: number }, select: { id: true, userId: true, guestEmail: true } });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(file instanceof File)) return NextResponse.json({ error: "File wajib dipilih" }, { status: 400 });
  try {
    return NextResponse.json({ path: await saveLocalImage(file, "returns") }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload gagal" }, { status: 400 });
  }
}
