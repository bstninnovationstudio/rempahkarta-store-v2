import { VoucherManager } from "@/components/voucher-manager";
import { prisma } from "@/lib/db";
import { serializeVoucher } from "@/lib/voucher-admin";
import { wibDayRange } from "@/lib/voucher";

export default async function VoucherPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const params = await searchParams;
  const requestedPage = Number(params.page || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  const requestedPageSize = Number(params.pageSize || 20);
  const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, 50) : 20;

  const { start: todayStart, end: todayEnd } = wibDayRange();
  const total = await prisma.voucher.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const skip = (normalizedPage - 1) * pageSize;

  const [vouchers, dailyUsages] = await Promise.all([
    prisma.voucher.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      include: { _count: { select: { usages: true } } },
    }),
    prisma.voucherUsage.groupBy({
      by: ["voucherId"],
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
  ]);

  const dailyMap = new Map(dailyUsages.map(item => [item.voucherId, item._count._all]));

  const pagination = {
    page: normalizedPage,
    pageSize,
    total,
    totalPages,
    from: total === 0 ? 0 : skip + 1,
    to: total === 0 ? 0 : Math.min(normalizedPage * pageSize, total),
  };

  return (
    <div className="admin-content">
      <VoucherManager
        vouchers={vouchers.map(item => ({
          ...serializeVoucher(item),
          startAt: item.startAt?.toISOString() || null,
          endAt: item.endAt?.toISOString() || null,
          usageCount: item._count.usages,
          dailyUsage: dailyMap.get(item.id) || 0,
        }))}
        pagination={pagination}
      />
    </div>
  );
}
