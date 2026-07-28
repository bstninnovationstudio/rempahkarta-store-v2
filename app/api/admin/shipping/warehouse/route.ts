import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { updateWarehouseConfig } from "@/lib/admin-shipping-config";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

export async function PUT(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:shipping-config-write", limit: 10 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  try {
    const updated = await updateWarehouseConfig(body as Parameters<typeof updateWarehouseConfig>[0]);
    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        actorId: String(admin.email),
        action: "shipping.warehouse_updated",
        entityType: "warehouse",
        entityId: "wh_main",
        after: { configurationUpdated: true },
      },
    });
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan informasi gudang";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
