import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_CART_ITEMS = 50;
const MAX_ITEM_QUANTITY = 20;

const cartItemSchema = z.object({
  productId: z.string().min(1).max(191),
  variantId: z.string().min(1).max(191),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
});

const cartSchema = z.object({
  cart: z.array(cartItemSchema).max(MAX_CART_ITEMS),
}).superRefine((value, context) => {
  const ids = new Set<string>();
  for (const item of value.cart) {
    if (ids.has(item.variantId)) {
      context.addIssue({ code: "custom", path: ["cart"], message: "Varian yang sama tidak boleh dikirim lebih dari sekali" });
      break;
    }
    ids.add(item.variantId);
  }
});

function availableStock(levels: Array<{ onHand: number; reserved: number; safetyStock: number }>) {
  return levels.reduce((total, level) => total + Math.max(0, level.onHand - level.reserved - level.safetyStock), 0);
}

async function readCart(userId: string) {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: MAX_CART_ITEMS,
    select: {
      productId: true,
      variantId: true,
      quantity: true,
      variant: {
        select: {
          active: true,
          price: true,
          inventory: { select: { onHand: true, reserved: true, safetyStock: true } },
          product: { select: { status: true } },
        },
      },
    },
  });
  return rows.flatMap(item => {
    const available = availableStock(item.variant.inventory);
    if (!item.variant.active || item.variant.product.status !== "active" || item.variant.price <= BigInt(0) || available <= 0) return [];
    return [{
      productId: item.productId,
      variantId: item.variantId,
      quantity: Math.min(item.quantity, available, MAX_ITEM_QUANTITY),
      available,
    }];
  });
}

async function validateCartItems(items: z.infer<typeof cartItemSchema>[]) {
  if (!items.length) return new Map<string, { id: string; productId: string; available: number }>();
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: items.map(item => item.variantId) }, active: true, product: { status: "active" } },
    select: {
      id: true,
      productId: true,
      inventory: { select: { onHand: true, reserved: true, safetyStock: true } },
    },
  });
  const map = new Map(variants.map(variant => [variant.id, {
    id: variant.id,
    productId: variant.productId,
    available: availableStock(variant.inventory),
  }]));
  for (const item of items) {
    const variant = map.get(item.variantId);
    if (!variant || variant.productId !== item.productId) throw new Error("Produk atau varian keranjang tidak valid");
    if (variant.available < 1) throw new Error("Salah satu produk di keranjang sedang habis");
  }
  return map;
}

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ cart: await readCart(customer.id) });
  } catch {
    return NextResponse.json({ error: "Gagal memuat keranjang belanja" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, { scope: "user:cart-write", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = cartSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Format data tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const variants = await validateCartItems(parsed.data.cart);
    await prisma.$transaction(async tx => {
      const existing = await tx.cartItem.findMany({ where: { userId: customer.id }, select: { id: true, variantId: true, quantity: true } });
      const existingByVariant = new Map(existing.map(item => [item.variantId, item]));
      const newVariantCount = parsed.data.cart.filter(item => !existingByVariant.has(item.variantId)).length;
      if (existing.length + newVariantCount > MAX_CART_ITEMS) throw new Error(`Keranjang maksimal berisi ${MAX_CART_ITEMS} varian`);

      for (const item of parsed.data.cart) {
        const variant = variants.get(item.variantId)!;
        const current = existingByVariant.get(item.variantId);
        const quantity = Math.min((current?.quantity || 0) + item.quantity, variant.available, MAX_ITEM_QUANTITY);
        if (current) {
          await tx.cartItem.update({ where: { id: current.id }, data: { productId: variant.productId, quantity } });
        } else {
          await tx.cartItem.create({ data: { userId: customer.id, productId: variant.productId, variantId: variant.id, quantity } });
        }
      }
    });
    return NextResponse.json({ cart: await readCart(customer.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menggabungkan keranjang belanja";
    return NextResponse.json({ error: message }, { status: /tidak valid|habis|maksimal/i.test(message) ? 409 : 500 });
  }
}

export async function PUT(request: Request) {
  const rate = checkRateLimit(request, { scope: "user:cart-write", limit: 30 });
  if (!rate.allowed) return rateLimitResponse(rate);
  const customer = await customerFromRequest();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = cartSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Format data tidak valid", details: parsed.error.flatten() }, { status: 400 });
    const variants = await validateCartItems(parsed.data.cart);
    const rows = parsed.data.cart.map(item => {
      const variant = variants.get(item.variantId)!;
      return {
        userId: customer.id,
        productId: variant.productId,
        variantId: variant.id,
        quantity: Math.min(item.quantity, variant.available, MAX_ITEM_QUANTITY),
      };
    });
    await prisma.$transaction(async tx => {
      await tx.cartItem.deleteMany({ where: { userId: customer.id } });
      if (rows.length) await tx.cartItem.createMany({ data: rows });
    });
    return NextResponse.json({ success: true, cart: await readCart(customer.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyelaraskan keranjang belanja";
    return NextResponse.json({ error: message }, { status: /tidak valid|habis/i.test(message) ? 409 : 500 });
  }
}
