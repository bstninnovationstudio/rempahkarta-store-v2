import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  dispatchWhatsappMessage,
  refreshPromotionCampaignStats,
} from "@/lib/whatsapp-notifications";

const BATCH_SIZE = 3;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rate = checkRateLimit(request, {
    scope: "admin:whatsapp-promotion-dispatch",
    limit: 120,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const campaign = await prisma.whatsappPromotionCampaign.findUnique({
    where: { id },
    select: { id: true, status: true, startedAt: true },
  });
  if (!campaign) return NextResponse.json({ error: "Pesan promosi tidak ditemukan" }, { status: 404 });
  if (campaign.status === "COMPLETED") {
    const completed = await refreshPromotionCampaignStats(campaign.id);
    return NextResponse.json({ success: true, campaign: completed, hasPending: false });
  }

  const now = new Date();
  await prisma.whatsappMessage.updateMany({
    where: {
      campaignId: campaign.id,
      status: "PENDING",
      attempts: { gt: 0 },
      lastAttemptAt: { lt: new Date(now.getTime() - 10 * 60_000) },
    },
    data: {
      status: "AMBIGUOUS",
      error: "Proses pengiriman terhenti setelah request dimulai; tidak diulang untuk mencegah duplikasi",
    },
  });
  const pending = await prisma.whatsappMessage.findMany({
    where: { campaignId: campaign.id, status: "PENDING", attempts: 0 },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: BATCH_SIZE,
    select: { id: true },
  });
  if (pending.length > 0) {
    await prisma.whatsappPromotionCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "SENDING",
        ...(!campaign.startedAt ? { startedAt: now } : {}),
      },
    });
    await Promise.all(pending.map(item => dispatchWhatsappMessage(item.id)));
  }
  const updated = await refreshPromotionCampaignStats(campaign.id);
  const hasPending = updated.status !== "COMPLETED";
  return NextResponse.json({ success: true, campaign: updated, hasPending });
}
