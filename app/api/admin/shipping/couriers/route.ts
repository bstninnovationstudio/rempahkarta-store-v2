import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFromRequest } from "@/lib/auth";
import { toggleCourierConfig } from "@/lib/admin-shipping-config";

const toggleSchema = z.object({
  code: z.string().min(1),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
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
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengubah status kurir";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
