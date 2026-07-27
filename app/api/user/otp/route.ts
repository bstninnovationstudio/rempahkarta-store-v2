import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCustomerActive, customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { formatWhatsappPhone } from "@/lib/gowa";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { refundSettingBindingHash, refundSettingSchema } from "@/lib/refund-setting";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  phoneVerificationBindingHash,
  requestWhatsappOtp,
  WhatsappOtpError,
} from "@/lib/whatsapp-otp";

const requestSchema = z.object({
  purpose: z.enum(["PHONE_VERIFICATION", "REFUND_SETTING_VERIFICATION"]),
  phone: z.string().trim().min(8).max(20).optional(),
  refundSetting: z.unknown().optional(),
  challengeId: z.string().uuid().optional(),
  turnstileToken: z.string().min(1).max(2048),
});

export async function POST(request: Request) {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userCheck = assertCustomerActive(customer);
  if (userCheck) return userCheck;

  const userRate = checkRateLimit(request, {
    scope: "user:whatsapp-otp:user",
    limit: 6,
    windowMs: 15 * 60_000,
    identity: customer.id,
  });
  if (!userRate.allowed) return rateLimitResponse(userRate);
  const ipRate = checkRateLimit(request, {
    scope: "user:whatsapp-otp:ip",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!ipRate.allowed) return rateLimitResponse(ipRate);

  try {
    const body = requestSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: "Permintaan OTP tidak valid", details: body.error.flatten() },
        { status: 400 },
      );
    }
    const turnstile = await verifyTurnstile(request, body.data.turnstileToken, "user_otp_send");
    if (!turnstile.success) return NextResponse.json({ error: turnstile.error }, { status: 403 });

    let phone: string;
    let bindingHash: string;

    if (body.data.challengeId) {
      const challenge = await prisma.whatsappOtpChallenge.findFirst({
        where: {
          id: body.data.challengeId,
          userId: customer.id,
          purpose: body.data.purpose,
        },
        select: { phone: true, bindingHash: true },
      });
      if (!challenge) {
        return NextResponse.json({ error: "Sesi OTP tidak ditemukan", code: "OTP_SESSION_INVALID" }, { status: 404 });
      }
      phone = challenge.phone;
      bindingHash = challenge.bindingHash;
    } else if (body.data.purpose === "PHONE_VERIFICATION") {
      if (!body.data.phone) {
        return NextResponse.json({ error: "Nomor WhatsApp wajib diisi" }, { status: 400 });
      }
      try {
        phone = formatWhatsappPhone(body.data.phone);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Nomor WhatsApp tidak valid" },
          { status: 400 },
        );
      }
      bindingHash = await phoneVerificationBindingHash(phone);
    } else {
      if (
        !customer.phone
        || !customer.phoneVerified
        || customer.name.trim().length < 2
        || customer.email.trim().length < 3
      ) {
        return NextResponse.json(
          { error: "Lengkapi dan verifikasi kontak utama sebelum mengatur rekening refund" },
          { status: 409 },
        );
      }
      const setting = refundSettingSchema.safeParse(body.data.refundSetting);
      if (!setting.success) {
        return NextResponse.json(
          { error: "Data rekening refund tidak valid", details: setting.error.flatten() },
          { status: 400 },
        );
      }
      phone = formatWhatsappPhone(customer.phone);
      bindingHash = await refundSettingBindingHash(setting.data);
    }

    const challenge = await requestWhatsappOtp({
      userId: customer.id,
      purpose: body.data.purpose,
      phone,
      bindingHash,
      resendChallengeId: body.data.challengeId,
    });
    return NextResponse.json({
      success: true,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      resendCount: challenge.resendCount,
      resendAvailableAt: challenge.resendAvailableAt.toISOString(),
      message: body.data.challengeId
        ? "Kode OTP baru telah dikirim melalui WhatsApp."
        : "Kode OTP telah dikirim melalui WhatsApp.",
    });
  } catch (error) {
    if (error instanceof WhatsappOtpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: error.retryAfterSeconds
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : undefined,
        },
      );
    }
    return NextResponse.json({ error: "Gagal memproses permintaan OTP" }, { status: 500 });
  }
}
