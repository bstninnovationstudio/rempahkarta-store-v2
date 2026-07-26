import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest, assertCustomerActive } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getProfileCompleteness } from "@/lib/user-profile";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(20).regex(/^[0-9+() -]+$/),
  turnstileToken: z.string().min(1).max(2048),
});

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const completion = await getProfileCompleteness(customer.id);
  return NextResponse.json({
    success: true,
    user: { name: customer.name, email: customer.email, phone: customer.phone },
    completion,
  });
}

export async function PUT(request: Request) {
  const rate = checkRateLimit(request, { scope: "user:profile-save", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userCheck = assertCustomerActive(customer);
  if (userCheck) return userCheck;

  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data profil tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "user_profile");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });

    const updated = await prisma.$transaction(async tx => {
      const user = await tx.user.update({
        where: { id: customer.id },
        data: { name: parsed.data.name, phone: parsed.data.phone },
      });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: "user.profile_updated",
          entityType: "user",
          entityId: customer.id,
          after: { contactComplete: true },
        },
      });
      return user;
    });

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({ success: true, user: { name: updated.name, phone: updated.phone }, completion });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}
