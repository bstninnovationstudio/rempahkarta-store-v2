import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest, assertCustomerActive } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getProfileCompleteness } from "@/lib/user-profile";
import {
  refundSettingBindingHash,
  refundSettingData,
  refundSettingSchema,
} from "@/lib/refund-setting";
import { consumeWhatsappOtp } from "@/lib/whatsapp-otp";
import { formatWhatsappPhone } from "@/lib/gowa";
import { Prisma } from "@prisma/client";

const refundSchema = z.intersection(refundSettingSchema, z.object({
  otpChallengeId: z.string().uuid(),
  otpCode: z.string().regex(/^\d{6}$/),
  turnstileToken: z.string().min(1).max(2048),
}));

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.userRefundSetting.findUnique({
      where: { userId: customer.id },
    });
    return NextResponse.json({ success: true, setting });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil pengaturan refund" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "user:refund-account-save", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userCheck = assertCustomerActive(customer);
  if (userCheck) return userCheck;

  try {
    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data refund tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "user_payment");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });

    const bindingHash = await refundSettingBindingHash(parsed.data);
    const data = refundSettingData(parsed.data);
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`User\` WHERE id = ${customer.id} FOR UPDATE`);
      const current = await tx.user.findUniqueOrThrow({ where: { id: customer.id } });
      if (
        current.name.trim().length < 2
        || current.email.trim().length < 3
        || !current.phone
        || !current.phoneVerified
      ) {
        return {
          error: {
            code: "CONTACT_NOT_VERIFIED",
            message: "Lengkapi dan verifikasi kontak utama sebelum mengatur rekening refund.",
            status: 409,
          },
        };
      }
      const phone = formatWhatsappPhone(current.phone);
      const consumed = await consumeWhatsappOtp(tx, {
        challengeId: parsed.data.otpChallengeId,
        userId: customer.id,
        purpose: "REFUND_SETTING_VERIFICATION",
        phone,
        bindingHash,
        code: parsed.data.otpCode,
      });
      if (!consumed.ok) {
        return { error: { code: consumed.code, message: consumed.message, status: consumed.status } };
      }
      const saved = await tx.userRefundSetting.upsert({
        where: { userId: customer.id },
        update: data,
        create: { userId: customer.id, ...data },
      });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: "user.refund_account_updated",
          entityType: "user",
          entityId: customer.id,
          after: { type: data.type, otpVerified: true },
        },
      });
      return { setting: saved };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: result.error.status },
      );
    }

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({ success: true, setting: result.setting, completion });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan refund" }, { status: 500 });
  }
}
