import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveLocalImage } from "@/lib/local-media";
import { customerFromRequest, assertCustomerActive } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { hasOversizedContentLength, MAX_IMAGE_MULTIPART_BYTES } from "@/lib/request-body";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const rate = checkRateLimit(request, { scope: "order:return-media", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  if (hasOversizedContentLength(request, MAX_IMAGE_MULTIPART_BYTES)) {
    return NextResponse.json({ error: "Ukuran request upload melebihi batas" }, { status: 413 });
  }
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userCheck = assertCustomerActive(customer);
  if (userCheck) return userCheck;


  const { number } = await params;
  const order = await prisma.order.findUnique({
    where: { publicNumber: number },
    select: {
      id: true,
      userId: true,
      guestEmail: true,
      fulfillmentState: true,
      returns: { where: { state: { notIn: ["rejected", "closed", "cancelled"] } }, take: 1, select: { id: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  const isOwner = order.userId === customer.id || (order.userId === null && order.guestEmail.toLowerCase() === customer.email.toLowerCase());
  if (!isOwner) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  if (order.fulfillmentState !== "completed") return NextResponse.json({ error: "Bukti retur hanya dapat diunggah setelah pesanan diterima" }, { status: 409 });
  if (order.returns.length) return NextResponse.json({ error: "Masih ada pengajuan retur aktif" }, { status: 409 });
  const data = await request.formData();
  const file = data.get("file");
  const turnstileToken = String(data.get("turnstileToken") || "");
  if (!turnstileToken || turnstileToken.length > 2048) {
    return NextResponse.json({ error: "Verifikasi keamanan wajib disertakan" }, { status: 400 });
  }
  const verification = await verifyTurnstile(request, turnstileToken, "return_media");
  if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
  if (!(file instanceof File)) return NextResponse.json({ error: "File wajib dipilih" }, { status: 400 });
  try {
    const fileName = await saveLocalImage(file, "returns", order.id, 5);
    return NextResponse.json({
      path: `/api/orders/${encodeURIComponent(number)}/media/${encodeURIComponent(fileName)}`,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload gagal" }, { status: 400 });
  }
}
