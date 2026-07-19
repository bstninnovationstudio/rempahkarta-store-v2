import { NextResponse } from "next/server";
import { z } from "zod";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { warehouseAreaId, getBiteshipApiKey } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  turnstileToken: z.string().min(1).max(2048),
  destinationAreaId: z.string().min(3).max(150),
  destinationPostalCode: z.number().int().min(10000).max(99999),
  items: z.array(z.object({
    variantId: z.string().min(1).max(191),
    quantity: z.number().int().positive().max(20),
  })).min(1).max(20),
});

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "checkout:shipping-quote", limit: 25 });
  if (!rate.allowed) return rateLimitResponse(rate);
  try {
    const customer = await customerFromRequest();
    if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Payload ongkir tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const verification = await verifyTurnstile(request, parsed.data.turnstileToken, "shipping_quotes");
    if (!verification.success) return NextResponse.json({ error: verification.error }, { status: 403 });
    const biteshipApiKey = getBiteshipApiKey();
    if (!biteshipApiKey) return NextResponse.json({ error: "BITESHIP_API_KEY belum dikonfigurasi" }, { status: 503 });
    const { turnstileToken: _token, ...input } = parsed.data;
    void _token;
    const variantIds = input.items.map(item => item.variantId);
    if (new Set(variantIds).size !== variantIds.length) {
      return NextResponse.json({ error: "Varian yang sama tidak boleh dikirim dua kali" }, { status: 400 });
    }
    const { prisma } = await import("@/lib/db");
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, active: true, product: { status: "active" } },
      include: { product: { select: { name: true } } },
    });
    if (variants.length !== input.items.length) {
      return NextResponse.json({ error: "Salah satu produk atau varian tidak tersedia" }, { status: 409 });
    }
    const variantsById = new Map(variants.map(variant => [variant.id, variant]));
    const shippingItems = input.items.map(item => {
      const variant = variantsById.get(item.variantId)!;
      return {
        name: variant.product.name,
        description: [variant.option1Value, variant.option2Value].filter(Boolean).join(" / ") || undefined,
        category: "food_and_drink",
        sku: variant.sku,
        value: Number(variant.price),
        quantity: item.quantity,
        weight: variant.weight,
        length: variant.length || undefined,
        width: variant.width || undefined,
        height: variant.height || undefined,
      };
    });
    const adapter = new BiteshipAdapter(process.env.BITESHIP_BASE_URL || "https://api.biteship.com", biteshipApiKey);
    const data = await adapter.rates({ originAreaId: warehouseAreaId(), originPostalCode: Number(process.env.WAREHOUSE_POSTAL_CODE) || undefined, destinationAreaId: input.destinationAreaId, destinationPostalCode: input.destinationPostalCode, couriers: process.env.ENABLED_COURIERS || "jne", items: shippingItems });
    return NextResponse.json(data);
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Tarif pengiriman gagal dimuat" }, { status: 502 }); }
}
