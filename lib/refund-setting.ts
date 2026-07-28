import { z } from "zod";
import { sha256 } from "@/lib/security";

const safeAccountText = (maximum: number) => z.string().trim().min(2).max(maximum)
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Data rekening mengandung karakter tidak valid");
const accountNumber = z.string().trim().min(5).max(80)
  .regex(/^[0-9 -]+$/, "Nomor rekening atau e-wallet tidak valid");

export const refundSettingSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bank"),
    bankName: safeAccountText(100),
    bankOwnerName: safeAccountText(160),
    bankNumber: accountNumber,
    ewalletName: z.null().optional(),
    ewalletOwnerName: z.null().optional(),
    ewalletNumber: z.null().optional(),
  }),
  z.object({
    type: z.literal("ewallet"),
    ewalletName: safeAccountText(100),
    ewalletOwnerName: safeAccountText(160),
    ewalletNumber: accountNumber,
    bankName: z.null().optional(),
    bankOwnerName: z.null().optional(),
    bankNumber: z.null().optional(),
  }),
]);

export type RefundSettingInput = z.infer<typeof refundSettingSchema>;

export function canonicalRefundSetting(input: RefundSettingInput) {
  return input.type === "bank"
    ? JSON.stringify({
        type: "bank",
        bankName: input.bankName.trim(),
        bankOwnerName: input.bankOwnerName.trim(),
        bankNumber: input.bankNumber.replace(/\s+/g, ""),
      })
    : JSON.stringify({
        type: "ewallet",
        ewalletName: input.ewalletName.trim(),
        ewalletOwnerName: input.ewalletOwnerName.trim(),
        ewalletNumber: input.ewalletNumber.replace(/\s+/g, ""),
      });
}

export async function refundSettingBindingHash(input: RefundSettingInput) {
  return sha256(`refund-setting:v1:${canonicalRefundSetting(input)}`);
}

export function refundSettingData(input: RefundSettingInput) {
  return input.type === "bank"
    ? {
        type: input.type,
        bankName: input.bankName.trim(),
        bankOwnerName: input.bankOwnerName.trim(),
        bankNumber: input.bankNumber.replace(/\s+/g, ""),
        ewalletName: null,
        ewalletOwnerName: null,
        ewalletNumber: null,
      }
    : {
        type: input.type,
        bankName: null,
        bankOwnerName: null,
        bankNumber: null,
        ewalletName: input.ewalletName.trim(),
        ewalletOwnerName: input.ewalletOwnerName.trim(),
        ewalletNumber: input.ewalletNumber.replace(/\s+/g, ""),
      };
}
