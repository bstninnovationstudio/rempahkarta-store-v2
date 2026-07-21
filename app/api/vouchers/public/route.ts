import { NextResponse } from "next/server";
import { getPublicVouchers } from "@/lib/voucher";

export async function GET() {
  const vouchers = await getPublicVouchers();
  return NextResponse.json({ data: vouchers.map(item => ({ ...item, endAt: item.endAt?.toISOString() || null })) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
}
