import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCustomerActive, customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const schema = z.object({
  shipmentNotifications: z.boolean().optional(),
  promotionNotifications: z.boolean().optional(),
  turnstileToken: z.string().min(1).max(2048),
}).refine(
  value => value.shipmentNotifications !== undefined || value.promotionNotifications !== undefined,
  { message: "Minimal satu preferensi harus disertakan" },
);

export async function PATCH(request: Request) {
  const rate = checkRateLimit(request, { scope: "user:whatsapp-notifications", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userCheck = assertCustomerActive(customer);
  if (userCheck) return userCheck;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Preferensi notifikasi tidak valid", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const turnstile = await verifyTurnstile(
      request,
      parsed.data.turnstileToken,
      "user_notifications",
    );
    if (!turnstile.success) return NextResponse.json({ error: turnstile.error }, { status: 403 });

    const now = new Date();
    const updated = await prisma.$transaction(async tx => {
      const data = {
        ...(parsed.data.shipmentNotifications !== undefined
          ? {
              whatsappShipmentNotifications: parsed.data.shipmentNotifications,
              whatsappShipmentConsentedAt: parsed.data.shipmentNotifications ? now : null,
            }
          : {}),
        ...(parsed.data.promotionNotifications !== undefined
          ? {
              whatsappPromotionNotifications: parsed.data.promotionNotifications,
              whatsappPromotionConsentedAt: parsed.data.promotionNotifications ? now : null,
            }
          : {}),
      };
      const user = await tx.user.update({ where: { id: customer.id }, data });
      await tx.auditLog.create({
        data: {
          actorType: "customer",
          actorId: customer.id,
          action: "user.whatsapp_preferences_updated",
          entityType: "user",
          entityId: customer.id,
          before: {
            shipmentNotifications: customer.whatsappShipmentNotifications,
            promotionNotifications: customer.whatsappPromotionNotifications,
          },
          after: {
            shipmentNotifications: user.whatsappShipmentNotifications,
            promotionNotifications: user.whatsappPromotionNotifications,
          },
        },
      });
      return user;
    });
    return NextResponse.json({
      success: true,
      shipmentNotifications: updated.whatsappShipmentNotifications,
      promotionNotifications: updated.whatsappPromotionNotifications,
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan preferensi notifikasi" }, { status: 500 });
  }
}
