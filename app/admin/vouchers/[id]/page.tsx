import { notFound } from "next/navigation";
import { VoucherForm } from "@/components/voucher-form";
import { prisma } from "@/lib/db";
import { serializeVoucher } from "@/lib/voucher-admin";

export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const voucher = await prisma.voucher.findUnique({ where: { id }, include: { _count: { select: { usages: true } } } });
  if (!voucher) notFound();
  const serialized = serializeVoucher(voucher);
  return <VoucherForm initial={{ ...serialized, startAt: voucher.startAt?.toISOString() || null, endAt: voucher.endAt?.toISOString() || null }} voucherId={voucher.id} usageCount={voucher._count.usages} />;
}
