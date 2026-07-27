import { z } from "zod";
import { sha256 } from "@/lib/security";

export const refundSettingSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bank"),
    bankName: z.string().trim().min(2).max(100),
    bankOwnerName: z.string().trim().min(2).max(160),
    bankNumber: z.string().trim().min(5).max(80),
    ewalletName: z.null().optional(),
    ewalletOwnerName: z.null().optional(),
    ewalletNumber: z.null().optional(),
  }),
  z.object({
    type: z.literal("ewallet"),
    ewalletName: z.string().trim().min(2).max(100),
    ewalletOwnerName: z.string().trim().min(2).max(160),
    ewalletNumber: z.string().trim().min(5).max(80),
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
