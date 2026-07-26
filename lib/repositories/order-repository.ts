import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security";
import { calculateServiceFee } from "@/lib/fee";
import { evaluateVoucher, normalizeVoucherCode } from "@/lib/voucher";

export type CheckoutInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  areaId?: string;
  userId: string;
  shipping: {
    company: string;
    type: string;
    name: string;
    price: number;
    eta?: string;
    collectionMethods?: string[];
  };
  items: Array<{ variantId: string; quantity: number }>;
  voucherCode?: string;
};

export async function createOrderWithReservation(input: CheckoutInput) {
  const token = randomToken();
  // Eight UUID hex characters keep the human-readable number compact while
  // avoiding the collision rate of the previous 16-bit daily suffix.
  const randomSuffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const publicNumber = `ORD-${date}-${randomSuffix}`;
  const normalizedItems = [...new Map(input.items.map(item => [item.variantId, item])).values()];
  if (normalizedItems.length !== input.items.length) {
    throw new Error("Varian yang sama tidak boleh dikirim dua kali");
  }

  const order = await prisma.$transaction(async tx => {
    const variantIds = normalizedItems.map(item => item.variantId);
    const [variants, inventoryLevels] = await Promise.all([
      tx.productVariant.findMany({
        where: { id: { in: variantIds }, active: true, product: { status: "active" } },
        include: { product: true },
      }),
      // Lifecycle inventory helpers consistently use the first level by id.
      // Fetch all candidates once to avoid one SELECT per checkout item.
      tx.inventoryLevel.findMany({
        where: { variantId: { in: variantIds } },
        orderBy: { id: "asc" },
      }),
    ]);
    if (variants.length !== normalizedItems.length) {
      throw new Error("Produk atau varian tidak tersedia");
    }

    const variantById = new Map(variants.map(variant => [variant.id, variant]));
    const inventoryByVariant = new Map<string, (typeof inventoryLevels)[number]>();
    for (const level of inventoryLevels) {
      if (!inventoryByVariant.has(level.variantId)) inventoryByVariant.set(level.variantId, level);
    }

    let subtotal = BigInt(0);
    for (const item of normalizedItems) {
      const variant = variantById.get(item.variantId)!;
      const inventory = inventoryByVariant.get(item.variantId);
      if (!inventory || inventory.onHand - inventory.reserved < item.quantity) {
        throw new Error(`Stok ${variant.sku} tidak mencukupi`);
      }
      const updated = await tx.inventoryLevel.updateMany({
        where: {
          id: inventory.id,
          version: inventory.version,
          onHand: { gte: inventory.reserved + item.quantity },
        },
        data: { reserved: { increment: item.quantity }, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new Error("Stok berubah karena checkout lain. Silakan ulangi checkout");
      }
      subtotal += variant.price * BigInt(item.quantity);
    }

    const shipping = BigInt(input.shipping.price);
    const voucherEvaluation = input.voucherCode
      ? await evaluateVoucher(tx, { code: normalizeVoucherCode(input.voucherCode), userId: input.userId, amounts: { subtotal, shippingFee: shipping } })
      : null;
    if (voucherEvaluation) {
      const quota = await tx.voucher.updateMany({
        where: {
          id: voucherEvaluation.voucher.id,
          status: "ACTIVE",
          ...(voucherEvaluation.voucher.totalLimit !== null ? { totalUsage: { lt: voucherEvaluation.voucher.totalLimit } } : {}),
        },
        data: { totalUsage: { increment: 1 } },
      });
      if (quota.count !== 1) throw new Error("Kuota voucher sudah habis");
    }
    const discountAmount = voucherEvaluation?.discountAmount || BigInt(0);
    const feeBreakdown = calculateServiceFee(Number(subtotal + shipping - discountAmount));
    const serviceFee = BigInt(feeBreakdown.serviceFee);
    const grandTotal = BigInt(feeBreakdown.grandTotal);

    const created = await tx.order.create({
      data: {
        publicNumber,
        ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
        guestName: input.name,
        guestEmail: input.email,
        guestPhone: input.phone,
        // Kept for schema compatibility only; URL-token access is disabled.
        accessTokenHash: await sha256(token),
        subtotal,
        shippingFee: shipping,
        ...(voucherEvaluation ? {
          voucher: { connect: { id: voucherEvaluation.voucher.id } },
          voucherCode: voucherEvaluation.voucher.code,
          discountAmount,
          voucherTarget: voucherEvaluation.voucher.target,
        } : {}),
        serviceFee,
        grandTotal,
        paymentState: "not_created",
        fulfillmentState: "awaiting_payment",
        addresses: {
          create: {
            type: "shipping",
            contactName: input.name,
            contactPhone: input.phone,
            contactEmail: input.email,
            address: input.address,
            postalCode: input.postalCode,
            areaId: input.areaId,
          },
        },
        items: {
          create: normalizedItems.map(item => {
            const variant = variantById.get(item.variantId)!;
            const options: Record<string, string> = {};
            if (variant.product.hasVariants && variant.product.option1Name && variant.option1Value) {
              options[variant.product.option1Name] = variant.option1Value;
            }
            if (variant.product.hasVariants && variant.product.option2Name && variant.option2Value) {
              options[variant.product.option2Name] = variant.option2Value;
            }
            return {
              variantId: variant.id,
              skuSnapshot: variant.sku,
              nameSnapshot: variant.product.name,
              optionsSnapshot: options,
              unitPrice: variant.price,
              quantity: item.quantity,
              weight: variant.weight,
              length: variant.length,
              width: variant.width,
              height: variant.height,
            };
          }),
        },
        quotes: {
          create: {
            courierCompany: input.shipping.company,
            courierType: input.shipping.type,
            courierName: input.shipping.name,
            price: shipping,
            etaText: input.shipping.eta,
            collectionMethods: input.shipping.collectionMethods || ["pickup"],
            request: { destinationAreaId: input.areaId, destinationPostalCode: input.postalCode },
            response: { selected: true },
            selectedAt: new Date(),
          },
        },
      },
    });
    if (voucherEvaluation) {
      await tx.voucherUsage.create({ data: { voucherId: voucherEvaluation.voucher.id, orderId: created.id, userId: input.userId, discountAmount } });
    }
    await tx.auditLog.create({
      data: {
        actorType: input.userId ? "customer" : "guest",
        actorId: input.userId,
        action: "order.created",
        entityType: "order",
        entityId: created.id,
        after: { publicNumber },
      },
    });
    return created;
  }, { isolationLevel: "Serializable" });

  return { order, token };
}
