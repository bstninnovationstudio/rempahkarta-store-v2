import { NextResponse } from "next/server";
import { finishExpiredVouchers } from "@/lib/voucher";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || (bearer !== secret && request.headers.get("x-cron-secret") !== secret)) return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  try { return NextResponse.json({ success: true, finishedCount: await finishExpiredVouchers(), timestamp: new Date().toISOString() }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Pembaruan voucher gagal" }, { status: 500 }); }
}

export const POST = GET;
