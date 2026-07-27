import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest, assertCustomerActive } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getProfileCompleteness } from "@/lib/user-profile";
import { formatWhatsappPhone } from "@/lib/gowa";
import { consumeWhatsappOtp, phoneVerificationBindingHash } from "@/lib/whatsapp-otp";
import { Prisma } from "@prisma/client";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(20).regex(/^[0-9+() -]+$/),
  otpChallengeId: z.string().uuid().optional(),
  otpCode: z.string().regex(/^\d{6}$/).optional(),
  turnstileToken: z.string().min(1).max(2048),
});

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const completion = await getProfileCompleteness(customer.id);
  return NextResponse.json({
    success: true,
    user: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      phoneVerified: customer.phoneVerified,
      phoneVerifiedAt: customer.phoneVerifiedAt,
    },
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

    let normalizedPhone: string;
    try {
      normalizedPhone = formatWhatsappPhone(parsed.data.phone);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Nomor WhatsApp tidak valid" },
        { status: 400 },
      );
    }
    const bindingHash = await phoneVerificationBindingHash(normalizedPhone);
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`User\` WHERE id = ${customer.id} FOR UPDATE`);
      const current = await tx.user.findUniqueOrThrow({ where: { id: customer.id } });
      let currentPhone = "";
      try {
        currentPhone = current.phone ? formatWhatsappPhone(current.phone) : "";
      } catch {
        // Nomor legacy yang tidak valid harus diverifikasi ulang.
      }
      const needsOtp = !current.phoneVerified || currentPhone !== normalizedPhone;
      if (needsOtp) {
        if (!parsed.data.otpChallengeId || !parsed.data.otpCode) {
          return {
            error: {
              code: "OTP_REQUIRED",
              message: "Verifikasi OTP diperlukan untuk menyimpan nomor WhatsApp.",
              status: 409,
            },
          };
        }
        const consumed = await consumeWhatsappOtp(tx, {
          challengeId: parsed.data.otpChallengeId,
          userId: customer.id,
          purpose: "PHONE_VERIFICATION",
          phone: normalizedPhone,
          bindingHash,
          code: parsed.data.otpCode,
        });
        if (!consumed.ok) {
          return { error: { code: consumed.code, message: consumed.message, status: consumed.status } };
        }
      }
      const user = await tx.user.update({
        where: { id: customer.id },
        data: {
          name: parsed.data.name,
          phone: normalizedPhone,
          ...(needsOtp ? { phoneVerified: true, phoneVerifiedAt: new Date() } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: "user.profile_updated",
          entityType: "user",
          entityId: customer.id,
          before: { phoneVerified: current.phoneVerified },
          after: {
            contactComplete: true,
            phoneVerified: user.phoneVerified,
            phoneChanged: currentPhone !== normalizedPhone,
          },
        },
      });
      return { user };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: result.error.status },
      );
    }

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({
      success: true,
      user: {
        name: result.user.name,
        phone: result.user.phone,
        phoneVerified: result.user.phoneVerified,
      },
      completion,
    });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}
