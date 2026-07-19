import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { readPrivateImage } from "@/lib/local-media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await params;
  const [admin, customer, returnRequest] = await Promise.all([
    adminFromRequest(),
    customerFromRequest(),
    prisma.returnRequest.findUnique({
      where: { id },
      select: { order: { select: { userId: true, guestEmail: true } } },
    }),
  ]);
  if (!returnRequest) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  const isOwner = customer && (
    returnRequest.order.userId === customer.id
    || (returnRequest.order.userId === null
      && returnRequest.order.guestEmail.toLowerCase() === customer.email.toLowerCase())
  );
  if (!admin && !isOwner) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  const image = await readPrivateImage("refunds", id, file);
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
