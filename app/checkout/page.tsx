import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CheckoutForm } from "@/components/checkout-form";
import { StoreHeader } from "@/components/store-header";
import { getCatalogProducts } from "@/lib/catalog";
import { turnstileSiteKey } from "@/lib/turnstile";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { getProfileCompleteness } from "@/lib/user-profile";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; from?: string }>;
}) {
  const customer = await customerFromRequest();
  if (!customer) {
    redirect("/login?redirect=/checkout");
  }
  const completion = await getProfileCompleteness(customer.id);
  if (!completion.isComplete) {
    redirect("/user/settings?onboarding=1&next=/checkout");
  }

  const [query, products] = await Promise.all([searchParams, getCatalogProducts()]);
  const fromCart = query.from === "cart" || !query.variant;

  let product = null;
  let variant = null;

  if (!fromCart) {
    product = products.find(candidate => candidate.variants.some(v => v.id === query.variant)) || null;
    variant = product?.variants.find(candidate => candidate.id === query.variant) || null;
  }

  const savedAddresses = await prisma.userAddress.findMany({
    where: { userId: customer.id }
  });

  return (
    <>
      <StoreHeader />
      <main className="simple-page">
        <div className="page-title">
          <Link
            href={fromCart ? "/cart" : product ? `/products/${product.slug}` : "/"}
            className="eyebrow"
          >
            <ChevronLeft size={13} /> Kembali
          </Link>
          <h1>Checkout</h1>
          <p>Lengkapi alamat, pilih pengiriman, lalu bayar melalui QRIS.</p>
        </div>
        <CheckoutForm
          product={product}
          variant={variant}
          allProducts={products}
          fromCart={fromCart}
          turnstileSiteKey={turnstileSiteKey()}
          savedAddresses={savedAddresses.map(addr => ({
            id: addr.id,
            label: addr.label,
            contactName: addr.contactName,
            contactPhone: addr.contactPhone,
            contactEmail: addr.contactEmail,
            address: addr.address,
            postalCode: addr.postalCode,
            areaId: addr.areaId
          }))}
          customerEmail={customer.email}
          customerName={customer.name}
        />
      </main>
    </>
  );
}
