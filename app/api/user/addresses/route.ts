import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getProfileCompleteness } from "@/lib/user-profile";
import { Prisma } from "@prisma/client";

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

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const addresses = await prisma.userAddress.findMany({
      where: { userId: customer.id },
      orderBy: { id: "asc" },
      take: 5,
    });
    return NextResponse.json({ success: true, addresses });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil daftar alamat" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "user:address-save", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
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
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "user_address");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    const { turnstileToken: _turnstileToken, ...addressInput } = parsed.data;
    void _turnstileToken;

    // Gunakan transaction untuk mencegah race condition agar jumlah alamat tidak melebihi 5
    const result = await prisma.$transaction(async (tx) => {
      // Serialize the per-user count invariant; a transaction alone does not
      // prevent two concurrent requests from both observing count = 4.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`User\` WHERE id = ${customer.id} FOR UPDATE`);
      const count = await tx.userAddress.count({
        where: { userId: customer.id },
      });

      if (count >= 5) {
        throw new Error("Maksimal alamat tersimpan adalah 5");
      }

      const address = await tx.userAddress.create({
        data: {
          userId: customer.id,
          ...addressInput,
        },
      });

      await tx.auditLog.create({
        data: { actorType: "customer", actorId: customer.id, action: "user.address_created", entityType: "user_address", entityId: address.id },
      });

      return address;
    });

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({ success: true, address: result, completion });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Gagal menyimpan alamat baru") }, { status: 400 });
  }
}
