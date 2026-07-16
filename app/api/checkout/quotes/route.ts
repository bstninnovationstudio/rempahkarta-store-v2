import { NextResponse } from "next/server";
import { z } from "zod";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { warehouseAreaId } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";
import { customerFromRequest } from "@/lib/customer-auth";

const optionalDimension = z.number().int().positive().max(1000).optional();
const schema = z.object({
  turnstileToken: z.string().min(1).max(2048),
  destinationAreaId: z.string().min(3).max(150),
  destinationPostalCode: z.number().int().min(10000).max(99999),
  items: z.array(z.object({ name: z.string().min(2).max(180), value: z.number().int().positive(), quantity: z.number().int().positive().max(20), weight: z.number().int().positive(), length: optionalDimension, width: optionalDimension, height: optionalDimension })).min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const customer = await customerFromRequest();
    if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Payload ongkir tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "shipping_quotes");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    if (!process.env.BITESHIP_API_KEY) return NextResponse.json({ error: "BITESHIP_API_KEY belum dikonfigurasi" }, { status: 503 });
    const { turnstileToken: _token, ...input } = parsed.data;
    void _token;
    const adapter = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", process.env.BITESHIP_API_KEY);
    const data = await adapter.rates({ originAreaId: warehouseAreaId(), originPostalCode: Number(process.env.WAREHOUSE_POSTAL_CODE) || undefined, destinationAreaId: input.destinationAreaId, destinationPostalCode: input.destinationPostalCode, couriers: process.env.ENABLED_COURIERS || "jne", items: input.items });
    return NextResponse.json(data);
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Tarif pengiriman gagal dimuat" }, { status: 502 }); }
}
