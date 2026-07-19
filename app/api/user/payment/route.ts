import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getProfileCompleteness } from "@/lib/user-profile";

const refundSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bank"),
    bankName: z.string().trim().min(2).max(100),
    bankOwnerName: z.string().trim().min(2).max(160),
    bankNumber: z.string().trim().min(5).max(80),
    turnstileToken: z.string().min(1).max(2048),
    ewalletName: z.null().optional(),
    ewalletOwnerName: z.null().optional(),
    ewalletNumber: z.null().optional(),
  }),
  z.object({
    type: z.literal("ewallet"),
    ewalletName: z.string().trim().min(2).max(100),
    ewalletOwnerName: z.string().trim().min(2).max(160),
    ewalletNumber: z.string().trim().min(5).max(80),
    turnstileToken: z.string().min(1).max(2048),
    bankName: z.null().optional(),
    bankOwnerName: z.null().optional(),
    bankNumber: z.null().optional(),
  }),
]);

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

  try {
    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data refund tidak valid", details: parsed.error.flatten() }, { status: 400 });
    }
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "user_payment");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });

    const { type, bankName, bankOwnerName, bankNumber, ewalletName, ewalletOwnerName, ewalletNumber } = parsed.data;

    const setting = await prisma.$transaction(async tx => {
      const saved = await tx.userRefundSetting.upsert({
        where: { userId: customer.id },
        update: { type, bankName: bankName || null, bankOwnerName: bankOwnerName || null, bankNumber: bankNumber || null, ewalletName: ewalletName || null, ewalletOwnerName: ewalletOwnerName || null, ewalletNumber: ewalletNumber || null },
        create: { userId: customer.id, type, bankName: bankName || null, bankOwnerName: bankOwnerName || null, bankNumber: bankNumber || null, ewalletName: ewalletName || null, ewalletOwnerName: ewalletOwnerName || null, ewalletNumber: ewalletNumber || null },
      });
      await tx.auditLog.create({
        data: { actorType: "customer", actorId: customer.id, action: "user.refund_account_updated", entityType: "user", entityId: customer.id, after: { type } },
      });
      return saved;
    });

    const completion = await getProfileCompleteness(customer.id);
    return NextResponse.json({ success: true, setting, completion });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan refund" }, { status: 500 });
  }
}
