import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhatsappPhone } from "@/lib/gowa";
import { saveLocalImage } from "@/lib/local-media";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, {
    scope: "admin:whatsapp-promotion-create",
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const message = String(form.get("message") || "").trim();
    const turnstileToken = String(form.get("turnstileToken") || "");
    if (message.length < 3 || message.length > 3000) {
      return NextResponse.json({ error: "Pesan promosi harus terdiri dari 3–3000 karakter" }, { status: 400 });
    }
    if (!turnstileToken || turnstileToken.length > 2048) {
      return NextResponse.json({ error: "Verifikasi keamanan wajib disertakan" }, { status: 400 });
    }
    const turnstile = await verifyTurnstile(request, turnstileToken, "admin_promotion_send");
    if (!turnstile.success) return NextResponse.json({ error: turnstile.error }, { status: 403 });

    const rawMedia = form.get("media");
    const media = rawMedia instanceof File && rawMedia.size > 0 ? rawMedia : null;
    if (media && !["image/jpeg", "image/png"].includes(media.type)) {
      return NextResponse.json({ error: "Media promosi harus berupa JPG atau PNG" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        phoneVerified: true,
        whatsappPromotionNotifications: true,
        phone: { not: null },
      },
      select: { id: true, phone: true },
    });
    const recipients = new Map<string, string>();
    for (const user of users) {
      if (!user.phone) continue;
      try {
        const phone = formatWhatsappPhone(user.phone);
        if (!recipients.has(phone)) recipients.set(phone, user.id);
      } catch {
        // Nomor invalid tidak dimasukkan ke snapshot penerima.
      }
    }

    const campaignId = crypto.randomUUID();
    const mediaFileName = media
      ? await saveLocalImage(media, "promotions", campaignId, 1)
      : null;
    const now = new Date();
    const campaign = await prisma.$transaction(async tx => {
      const created = await tx.whatsappPromotionCampaign.create({
        data: {
          id: campaignId,
          message,
          mediaFileName,
          mediaContentType: media?.type || null,
          status: recipients.size === 0 ? "COMPLETED" : "QUEUED",
          totalRecipients: recipients.size,
          createdBy: String(admin.email),
          ...(recipients.size === 0 ? { completedAt: now } : {}),
        },
      });
      if (recipients.size > 0) {
        await tx.whatsappMessage.createMany({
          data: Array.from(recipients, ([phone, userId]) => ({
            userId,
            campaignId,
            phone,
            kind: "PROMOTION",
            sourceType: "promotion_campaign",
            sourceId: campaignId,
            dedupeKey: `promotion:${campaignId}:${userId}`,
            body: message,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: String(admin.email),
          action: "whatsapp.promotion_created",
          entityType: "whatsapp_promotion_campaign",
          entityId: campaignId,
          after: {
            totalRecipients: recipients.size,
            hasMedia: Boolean(mediaFileName),
          },
        },
      });
      return created;
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat pesan promosi" },
      { status: 500 },
    );
  }
}
