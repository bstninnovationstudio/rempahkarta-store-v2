import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getProfileCompleteness } from "@/lib/user-profile";

const addressSchema = z.object({
  label: z.string().trim().min(1).max(80),
  contactName: z.string().trim().min(2).max(160),
  contactPhone: z.string().trim().min(8).max(20).regex(/^[0-9+() -]+$/),
  contactEmail: z.string().trim().email().max(200),
  address: z.string().trim().min(10).max(1000),
  postalCode: z.string().regex(/^\d{5}$/),
  areaId: z.string().min(3).max(120),
  turnstileToken: z.string().min(1).max(2048),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, { scope: "user:address-save", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
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
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "user_address");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    const { turnstileToken: _turnstileToken, ...addressInput } = parsed.data;
    void _turnstileToken;

    const updated = await prisma.$transaction(async tx => {
      const address = await tx.userAddress.update({ where: { id }, data: addressInput });
      await tx.auditLog.create({
        data: { actorType: "customer", actorId: customer.id, action: "user.address_updated", entityType: "user_address", entityId: id },
      });
      return address;
    });

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({ success: true, address: updated, completion });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui alamat" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, { scope: "user:address-save", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    let turnstileToken = request.headers.get("x-turnstile-token") || "";
    if (!turnstileToken) {
      try {
        const body = z.object({ turnstileToken: z.string().min(1).max(2048) }).safeParse(await request.json());
        if (body.success) turnstileToken = body.data.turnstileToken;
      } catch { /* body is optional when token is sent as a header */ }
    }
    const verification = await verifyTurnstile(request, turnstileToken, "user_address");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    const existing = await prisma.userAddress.findFirst({
      where: { id, userId: customer.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alamat tidak ditemukan" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.userAddress.delete({ where: { id } }),
      prisma.auditLog.create({
        data: { actorType: "customer", actorId: customer.id, action: "user.address_deleted", entityType: "user_address", entityId: id },
      }),
    ]);

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({ success: true, completion });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus alamat" }, { status: 500 });
  }
}
