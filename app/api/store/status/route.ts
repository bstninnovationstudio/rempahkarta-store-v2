import { NextResponse } from "next/server";
import { getStoreOperationalStatus } from "@/lib/store-schedule";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rate = checkRateLimit(request, { scope: "store:status", limit: 60 });
  if (!rate.allowed) return rateLimitResponse(rate);

  try {
    const status = await getStoreOperationalStatus();
    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[Store Status GET Error]", error);
    return NextResponse.json(
      {
        isHoliday: false,
        isMaintenance: false,
        activeSchedule: null,
        holidayEndAtWib: null,
        maintenanceEndAtWib: null,
        announcement: null,
      },
      { status: 500 }
    );
  }
}
