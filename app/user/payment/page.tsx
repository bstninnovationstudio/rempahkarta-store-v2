import React from "react";
import { prisma } from "@/lib/db";
import { customerFromRequest } from "@/lib/customer-auth";
import { UserPaymentClient } from "@/components/user-payment-client";

export default async function UserPaymentPage() {
  const customer = await customerFromRequest();
  if (!customer) return null;

  const setting = await prisma.userRefundSetting.findUnique({
    where: { userId: customer.id },
  });

  return (
    <UserPaymentClient
      initialSetting={
        setting
          ? {
              id: setting.id,
              type: setting.type as "bank" | "ewallet",
              bankName: setting.bankName,
              bankOwnerName: setting.bankOwnerName,
              bankNumber: setting.bankNumber,
              ewalletName: setting.ewalletName,
              ewalletOwnerName: setting.ewalletOwnerName,
              ewalletNumber: setting.ewalletNumber,
            }
          : null
      }
    />
  );
}
