import React from "react";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { turnstileSiteKey } from "@/lib/turnstile";
import { UserAddressesClient } from "@/components/user-addresses-client";

export default async function UserAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; redirect?: string }>;
}) {
  const customer = await customerFromRequest();
  if (!customer) return null;

  const query = await searchParams;

  const addresses = await prisma.userAddress.findMany({
    where: { userId: customer.id },
    orderBy: { id: "desc" },
  });

  return (
    <UserAddressesClient
      initialAddresses={addresses.map(addr => ({
        id: addr.id,
        label: addr.label,
        contactName: addr.contactName,
        contactPhone: addr.contactPhone,
        contactEmail: addr.contactEmail,
        address: addr.address,
        postalCode: addr.postalCode,
        areaId: addr.areaId,
      }))}
      turnstileSiteKey={turnstileSiteKey()}
      defaultAction={query.action}
      redirectUrl={query.redirect}
    />
  );
}
