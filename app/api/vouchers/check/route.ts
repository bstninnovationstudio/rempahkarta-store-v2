import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { calculateServiceFee } from "@/lib/fee";
import { evaluateVoucher } from "@/lib/voucher";
import { hasExactAppOrigin } from "@/lib/security";

const schema = z.object({
  turnstileToken: z.string().min(1).max(2048),
  code: z.string().trim().min(3).max(50),
  subtotal: z.number().int().nonnegative().max(100_000_000),
  shippingFee: z.number().int().nonnegative().max(100_000_000),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "voucher:check", limit: 15 });
  if (!rate.allowed) return rateLimitResponse(rate);
  if (!hasExactAppOrigin(request)) return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Silakan login untuk menggunakan promo" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data voucher tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "voucher_check");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    const evaluation = await prisma.$transaction(tx => evaluateVoucher(tx, {
      code: parsed.data.code,
      userId: customer.id,
      amounts: { subtotal: BigInt(parsed.data.subtotal), shippingFee: BigInt(parsed.data.shippingFee) },
    }));
    const discountedBase = parsed.data.subtotal + parsed.data.shippingFee - Number(evaluation.discountAmount);
    const fees = calculateServiceFee(discountedBase);
    return NextResponse.json({
      success: true,
      voucher: { code: evaluation.voucher.code, name: evaluation.voucher.name, target: evaluation.voucher.target, discountAmount: Number(evaluation.discountAmount) },
      serviceFee: fees.serviceFee,
      grandTotal: fees.grandTotal,
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Voucher tidak dapat diperiksa" }, { status: 409 });
  }
}
