import { AdminPromotionManager } from "@/components/admin-promotion-manager";
import { prisma } from "@/lib/db";
import { turnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const [eligibleRecipientCount, campaigns] = await Promise.all([
    prisma.user.count({
      where: {
        status: "ACTIVE",
        phoneVerified: true,
        whatsappPromotionNotifications: true,
        phone: { not: null },
      },
    }),
    prisma.whatsappPromotionCampaign.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        message: true,
        mediaFileName: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        ambiguousCount: true,
        skippedCount: true,
        createdBy: true,
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Komunikasi pelanggan</p>
          <h1>Pesan Promosi</h1>
          <p>Kirim info dan penawaran WhatsApp kepada pelanggan yang telah memberi persetujuan.</p>
        </div>
      </div>
      <AdminPromotionManager
        eligibleRecipientCount={eligibleRecipientCount}
        turnstileSiteKey={turnstileSiteKey()}
        initialCampaigns={campaigns.map(campaign => ({
          id: campaign.id,
          message: campaign.message,
          hasMedia: Boolean(campaign.mediaFileName),
          status: campaign.status,
          totalRecipients: campaign.totalRecipients,
          sentCount: campaign.sentCount,
          failedCount: campaign.failedCount,
          ambiguousCount: campaign.ambiguousCount,
          skippedCount: campaign.skippedCount,
          createdBy: campaign.createdBy,
          createdAt: campaign.createdAt.toISOString(),
          completedAt: campaign.completedAt?.toISOString() || null,
        }))}
      />
    </div>
  );
}
