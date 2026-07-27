import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPrivateImage } from "@/lib/local-media";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const campaign = await prisma.whatsappPromotionCampaign.findUnique({
    where: { id },
    select: { mediaFileName: true },
  });
  if (!campaign?.mediaFileName) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  const image = await readPrivateImage("promotions", id, campaign.mediaFileName);
  if (!image) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${campaign.mediaFileName}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
