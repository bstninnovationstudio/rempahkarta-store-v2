import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { readPrivateImage } from "@/lib/local-media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string; file: string }> },
) {
  const { number, file } = await params;
  const [admin, customer, order] = await Promise.all([
    adminFromRequest(),
    customerFromRequest(),
    prisma.order.findUnique({
      where: { publicNumber: number },
      select: { id: true, userId: true, guestEmail: true },
    }),
  ]);
  if (!order) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  const isOwner = customer && (
    order.userId === customer.id
    || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase())
  );
  if (!admin && !isOwner) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  const image = await readPrivateImage("returns", order.id, file);
  if (!image) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
