import { VoucherForm, emptyVoucherDraft } from "@/components/voucher-form";

export default function NewVoucherPage() {
  return <VoucherForm initial={emptyVoucherDraft} />;
}
