import { Prisma, type PrismaClient, type WhatsappOtpPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatWhatsappPhone, sendWhatsappMessage } from "@/lib/gowa";
import { assertStrongJwtSecret, constantTimeEqual, hmacHex, sha256 } from "@/lib/security";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_COOLDOWN_MS = 60_000;
export const OTP_MAX_RESENDS = 1;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_NEW_SESSIONS_PER_HOUR = 3;

type DbClient = Prisma.TransactionClient | PrismaClient;

export class WhatsappOtpError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "WhatsappOtpError";
  }
}

function otpSecret() {
  return assertStrongJwtSecret(
    process.env.WHATSAPP_OTP_SECRET || process.env.CUSTOMER_JWT_SECRET || process.env.AUTH_SECRET,
    "WHATSAPP_OTP_SECRET, CUSTOMER_JWT_SECRET, atau AUTH_SECRET",
  );
}

export function generateOtpCode() {
  const maximum = 2 ** 32;
  const safeMaximum = Math.floor(maximum / 1_000_000) * 1_000_000;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= safeMaximum);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export async function phoneVerificationBindingHash(phone: string) {
  return sha256(`phone-verification:v1:${formatWhatsappPhone(phone)}`);
}

export async function otpCodeHash(input: {
  challengeId: string;
  userId: string;
  purpose: WhatsappOtpPurpose;
  phone: string;
  code: string;
}) {
  return hmacHex(
    otpSecret(),
    [
      "whatsapp-otp:v1",
      input.challengeId,
      input.userId,
      input.purpose,
      formatWhatsappPhone(input.phone),
      input.code,
    ].join(":"),
  );
}

function purposeLabel(purpose: WhatsappOtpPurpose) {
  return purpose === "PHONE_VERIFICATION"
    ? "verifikasi nomor WhatsApp akun Anda"
    : "konfirmasi perubahan rekening pengembalian dana";
}

export function buildOtpMessage(code: string, purpose: WhatsappOtpPurpose) {
  return [
    `Kode OTP REMPAHKARTA Anda: *${code}*`,
    "",
    `Gunakan kode ini untuk ${purposeLabel(purpose)}. Kode berlaku 5 menit.`,
    "Jangan berikan kode ini kepada siapa pun, termasuk pihak yang mengaku dari REMPAHKARTA.",
  ].join("\n");
}

function maskedPhone(phone: string) {
  return phone.length <= 4 ? phone : `${phone.slice(0, 4)}••••${phone.slice(-4)}`;
}

async function invalidateChallengeAfterSendFailure(challengeId: string) {
  await prisma.whatsappOtpChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { invalidatedAt: new Date() },
  });
}

export async function requestWhatsappOtp(input: {
  userId: string;
  purpose: WhatsappOtpPurpose;
  phone: string;
  bindingHash: string;
  resendChallengeId?: string;
}) {
  const phone = formatWhatsappPhone(input.phone);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const code = generateOtpCode();

  let challenge: { id: string; resendCount: number; expiresAt: Date };
  let isResend = false;

  if (input.resendChallengeId) {
    const current = await prisma.whatsappOtpChallenge.findFirst({
      where: {
        id: input.resendChallengeId,
        userId: input.userId,
        purpose: input.purpose,
      },
    });
    if (!current || current.invalidatedAt || current.consumedAt) {
      throw new WhatsappOtpError("Sesi OTP tidak aktif. Mulai verifikasi dari awal.", "OTP_SESSION_INVALID", 409);
    }
    if (current.expiresAt <= now) {
      throw new WhatsappOtpError("Kode OTP sudah kedaluwarsa. Mulai verifikasi dari awal.", "OTP_EXPIRED", 410);
    }
    if (current.resendCount >= OTP_MAX_RESENDS) {
      throw new WhatsappOtpError("Batas kirim ulang sudah digunakan. Mulai verifikasi dari awal.", "OTP_RESEND_LIMIT", 409);
    }
    const retryAfterMs = OTP_RESEND_COOLDOWN_MS - (now.getTime() - current.lastSentAt.getTime());
    if (retryAfterMs > 0) {
      const seconds = Math.ceil(retryAfterMs / 1000);
      throw new WhatsappOtpError(
        `Kirim ulang tersedia dalam ${seconds} detik.`,
        "OTP_RESEND_COOLDOWN",
        429,
        seconds,
      );
    }
    if (current.phone !== phone || current.bindingHash !== input.bindingHash) {
      throw new WhatsappOtpError("Data verifikasi telah berubah. Mulai verifikasi dari awal.", "OTP_BINDING_MISMATCH", 409);
    }

    const codeHash = await otpCodeHash({
      challengeId: current.id,
      userId: input.userId,
      purpose: input.purpose,
      phone,
      code,
    });
    const changed = await prisma.whatsappOtpChallenge.updateMany({
      where: {
        id: current.id,
        userId: input.userId,
        resendCount: { lt: OTP_MAX_RESENDS },
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
        lastSentAt: { lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) },
      },
      data: {
        codeHash,
        resendCount: { increment: 1 },
        attempts: 0,
        lastSentAt: now,
        expiresAt,
      },
    });
    if (changed.count !== 1) {
      throw new WhatsappOtpError("Sesi OTP sudah berubah. Silakan coba kembali.", "OTP_SESSION_CONFLICT", 409);
    }
    challenge = { id: current.id, resendCount: current.resendCount + 1, expiresAt };
    isResend = true;
  } else {
    const challengeId = crypto.randomUUID();
    const codeHash = await otpCodeHash({
      challengeId,
      userId: input.userId,
      purpose: input.purpose,
      phone,
      code,
    });
    challenge = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM \`User\` WHERE id = ${input.userId} FOR UPDATE`);
      const since = new Date(now.getTime() - 60 * 60_000);
      const [userSessions, phoneSessions] = await Promise.all([
        tx.whatsappOtpChallenge.count({
          where: { userId: input.userId, createdAt: { gte: since } },
        }),
        tx.whatsappOtpChallenge.count({
          where: { phone, createdAt: { gte: since } },
        }),
      ]);
      if (
        userSessions >= OTP_MAX_NEW_SESSIONS_PER_HOUR
        || phoneSessions >= OTP_MAX_NEW_SESSIONS_PER_HOUR
      ) {
        throw new WhatsappOtpError(
          "Batas sesi OTP per jam telah tercapai. Silakan coba kembali nanti.",
          "OTP_HOURLY_LIMIT",
          429,
          3600,
        );
      }
      await tx.whatsappOtpChallenge.updateMany({
        where: {
          userId: input.userId,
          purpose: input.purpose,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: now },
      });
      return tx.whatsappOtpChallenge.create({
        data: {
          id: challengeId,
          userId: input.userId,
          purpose: input.purpose,
          phone,
          codeHash,
          bindingHash: input.bindingHash,
          lastSentAt: now,
          expiresAt,
        },
        select: { id: true, resendCount: true, expiresAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  try {
    await sendWhatsappMessage(phone, buildOtpMessage(code, input.purpose));
  } catch {
    await invalidateChallengeAfterSendFailure(challenge.id);
    throw new WhatsappOtpError(
      "Kode OTP belum dapat dikirim melalui WhatsApp. Silakan mulai verifikasi kembali.",
      "OTP_SEND_FAILED",
      502,
    );
  }

  await prisma.auditLog.create({
    data: {
      actorType: "customer",
      actorId: input.userId,
      action: isResend ? "whatsapp.otp_resent" : "whatsapp.otp_sent",
      entityType: "whatsapp_otp_challenge",
      entityId: challenge.id,
      after: {
        purpose: input.purpose,
        phone: maskedPhone(phone),
        resendCount: challenge.resendCount,
      },
    },
  });

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    resendCount: challenge.resendCount,
    resendAvailableAt: new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS),
  };
}

export type ConsumeOtpResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number };

export async function consumeWhatsappOtp(
  tx: DbClient,
  input: {
    challengeId: string;
    userId: string;
    purpose: WhatsappOtpPurpose;
    phone: string;
    bindingHash: string;
    code: string;
  },
): Promise<ConsumeOtpResult> {
  if (!/^\d{6}$/.test(input.code)) {
    return { ok: false, code: "OTP_INVALID", message: "Kode OTP harus terdiri dari 6 digit.", status: 400 };
  }
  await tx.$queryRaw(Prisma.sql`
    SELECT id FROM \`WhatsappOtpChallenge\`
    WHERE id = ${input.challengeId}
    FOR UPDATE
  `);
  const challenge = await tx.whatsappOtpChallenge.findUnique({ where: { id: input.challengeId } });
  const now = new Date();
  const phone = formatWhatsappPhone(input.phone);
  if (
    !challenge
    || challenge.userId !== input.userId
    || challenge.purpose !== input.purpose
    || challenge.phone !== phone
    || challenge.bindingHash !== input.bindingHash
  ) {
    return { ok: false, code: "OTP_SESSION_INVALID", message: "Sesi OTP tidak sesuai. Mulai verifikasi dari awal.", status: 409 };
  }
  if (challenge.consumedAt || challenge.invalidatedAt) {
    return { ok: false, code: "OTP_SESSION_USED", message: "Sesi OTP sudah tidak dapat digunakan.", status: 409 };
  }
  if (challenge.expiresAt <= now) {
    await tx.whatsappOtpChallenge.update({
      where: { id: challenge.id },
      data: { invalidatedAt: now },
    });
    return { ok: false, code: "OTP_EXPIRED", message: "Kode OTP sudah kedaluwarsa.", status: 410 };
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, code: "OTP_ATTEMPTS_EXCEEDED", message: "Batas percobaan OTP telah tercapai.", status: 429 };
  }

  const expected = await otpCodeHash({
    challengeId: challenge.id,
    userId: input.userId,
    purpose: input.purpose,
    phone,
    code: input.code,
  });
  if (!constantTimeEqual(expected, challenge.codeHash)) {
    const attempts = challenge.attempts + 1;
    await tx.whatsappOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts,
        ...(attempts >= OTP_MAX_ATTEMPTS ? { invalidatedAt: now } : {}),
      },
    });
    return {
      ok: false,
      code: attempts >= OTP_MAX_ATTEMPTS ? "OTP_ATTEMPTS_EXCEEDED" : "OTP_INVALID",
      message: attempts >= OTP_MAX_ATTEMPTS
        ? "Batas percobaan OTP telah tercapai. Mulai verifikasi dari awal."
        : `Kode OTP tidak sesuai. Tersisa ${OTP_MAX_ATTEMPTS - attempts} percobaan.`,
      status: attempts >= OTP_MAX_ATTEMPTS ? 429 : 400,
    };
  }

  const consumed = await tx.whatsappOtpChallenge.updateMany({
    where: {
      id: challenge.id,
      consumedAt: null,
      invalidatedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });
  return consumed.count === 1
    ? { ok: true }
    : { ok: false, code: "OTP_SESSION_CONFLICT", message: "Sesi OTP sudah digunakan.", status: 409 };
}
