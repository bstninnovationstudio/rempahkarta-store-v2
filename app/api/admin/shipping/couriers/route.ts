import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { toggleCourierConfig } from "@/lib/admin-shipping-config";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const toggleSchema = z.object({
  code: z.string().min(1),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const rate = checkRateLimit(request, { scope: "admin:shipping-courier-write", limit: 20 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload toggle kurir tidak valid" }, { status: 400 });
  }

  try {
    const updated = await toggleCourierConfig(parsed.data.code, parsed.data.enabled);
    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        actorId: String(admin.email),
        action: "shipping.courier_toggled",
        entityType: "shipping_courier",
        entityId: parsed.data.code,
        after: { enabled: parsed.data.enabled },
      },
    });
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengubah status kurir";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
