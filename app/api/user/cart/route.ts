import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";

const cartItemSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().min(1)
});

const cartSchema = z.object({
  cart: z.array(cartItemSchema)
});

// GET: Ambil isi keranjang belanja user dari database
export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbItems = await prisma.cartItem.findMany({
      where: { userId: customer.id },
      include: {
        variant: true
      }
    });

    // Validasi stok aktif
    const validItems = dbItems.filter(item => item.variant.active && item.variant.price > 0);

    return NextResponse.json({
      cart: validItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: Math.min(item.quantity, item.variant.lowStockThreshold) // Batasi sesuai stok jika diperlukan, atau kembalikan as-is
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memuat keranjang belanja" }, { status: 500 });
  }
}

// POST: Gabungkan (merge) keranjang belanja lokal ke database
export async function POST(request: Request) {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = cartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Format data tidak valid" }, { status: 400 });
    }

    const { cart } = parsed.data;

    // Lakukan merge dalam transaksi database
    await prisma.$transaction(async (tx) => {
      for (const localItem of cart) {
        // Cek apakah varian aktif & valid
        const variant = await tx.productVariant.findUnique({
          where: { id: localItem.variantId }
        });
        if (!variant || !variant.active) continue;

        const existing = await tx.cartItem.findUnique({
          where: {
            userId_variantId: {
              userId: customer.id,
              variantId: localItem.variantId
            }
          }
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + localItem.quantity
            }
          });
        } else {
          await tx.cartItem.create({
            data: {
              userId: customer.id,
              productId: localItem.productId,
              variantId: localItem.variantId,
              quantity: localItem.quantity
            }
          });
        }
      }
    });

    // Ambil hasil akhir keranjang dari database
    const finalItems = await prisma.cartItem.findMany({
      where: { userId: customer.id }
    });

    return NextResponse.json({
      cart: finalItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menggabungkan keranjang belanja" }, { status: 500 });
  }
}

// PUT: Sinkronisasi penuh keranjang belanja lokal ke database (overwrite)
export async function PUT(request: Request) {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = cartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Format data tidak valid" }, { status: 400 });
    }

    const { cart } = parsed.data;

    // Bersihkan data lama, lalu masukkan data baru dalam transaksi
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { userId: customer.id }
      });

      if (cart.length > 0) {
        // Validasi keaktifan varian sebelum menyimpan
        const activeCart = [];
        for (const item of cart) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId }
          });
          if (variant && variant.active) {
            activeCart.push({
              userId: customer.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity
            });
          }
        }

        if (activeCart.length > 0) {
          await tx.cartItem.createMany({
            data: activeCart
          });
        }
      }
    });

    return NextResponse.json({ success: true, cart });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menyelaraskan keranjang belanja" }, { status: 500 });
  }
}
