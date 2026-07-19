import { prisma } from "@/lib/db";

export type ProfileCompleteness = {
  isComplete: boolean;
  missing: Array<"name" | "email" | "phone" | "address" | "refundAccount">;
  sections: {
    contact: boolean;
    address: boolean;
    refundAccount: boolean;
  };
};

function hasText(value: string | null | undefined, minimum = 1) {
  return Boolean(value && value.trim().length >= minimum);
}

export async function getProfileCompleteness(userId: string): Promise<ProfileCompleteness> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      addresses: { select: { id: true }, take: 1 },
      refundSetting: {
        select: {
          type: true,
          bankName: true,
          bankOwnerName: true,
          bankNumber: true,
          ewalletName: true,
          ewalletOwnerName: true,
          ewalletNumber: true,
        },
      },
    },
  });

  if (!user) {
    return {
      isComplete: false,
      missing: ["name", "email", "phone", "address", "refundAccount"],
      sections: { contact: false, address: false, refundAccount: false },
    };
  }

  const missing: ProfileCompleteness["missing"] = [];
  if (!hasText(user.name, 2)) missing.push("name");
  if (!hasText(user.email, 3)) missing.push("email");
  if (!hasText(user.phone, 8)) missing.push("phone");
  if (user.addresses.length === 0) missing.push("address");

  const refund = user.refundSetting;
  const hasRefundAccount = refund?.type === "bank"
    ? hasText(refund.bankName, 2) && hasText(refund.bankOwnerName, 2) && hasText(refund.bankNumber, 5)
    : refund?.type === "ewallet"
      ? hasText(refund.ewalletName, 2) && hasText(refund.ewalletOwnerName, 2) && hasText(refund.ewalletNumber, 5)
      : false;
  if (!hasRefundAccount) missing.push("refundAccount");

  return {
    isComplete: missing.length === 0,
    missing,
    sections: {
      contact: !missing.some(item => item === "name" || item === "email" || item === "phone"),
      address: !missing.includes("address"),
      refundAccount: !missing.includes("refundAccount"),
    },
  };
}

