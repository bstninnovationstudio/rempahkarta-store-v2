import Link from "next/link";
import Script from "next/script";
import { ArrowRight, LockKeyhole, Settings2 } from "lucide-react";
import { UserAddressesClient } from "@/components/user-addresses-client";
import { UserContactSettingsClient } from "@/components/user-contact-settings-client";
import { UserPaymentClient } from "@/components/user-payment-client";
import { customerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { turnstileSiteKey } from "@/lib/turnstile";
import { safeInternalPath } from "@/lib/safe-redirect";

function hasText(value: string | null | undefined, minimum = 1) {
  return Boolean(value && value.trim().length >= minimum);
}

function isRefundSettingComplete(setting: {
  type: string;
  bankName: string | null;
  bankOwnerName: string | null;
  bankNumber: string | null;
  ewalletName: string | null;
  ewalletOwnerName: string | null;
  ewalletNumber: string | null;
} | null) {
  if (!setting) return false;
  if (setting.type === "bank") {
    return hasText(setting.bankName, 2) && hasText(setting.bankOwnerName, 2) && hasText(setting.bankNumber, 5);
  }
  if (setting.type === "ewallet") {
    return hasText(setting.ewalletName, 2) && hasText(setting.ewalletOwnerName, 2) && hasText(setting.ewalletNumber, 5);
  }
  return false;
}

export default async function UserSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; redirect?: string; next?: string; onboarding?: string }>;
}) {
  const customer = await customerFromRequest();
  if (!customer) return null;

  const query = await searchParams;
  const [addresses, setting] = await Promise.all([
    prisma.userAddress.findMany({
      where: { userId: customer.id },
      orderBy: { id: "desc" },
      take: 5,
      select: {
        id: true,
        label: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        address: true,
        postalCode: true,
        areaId: true,
      },
    }),
    prisma.userRefundSetting.findUnique({ where: { userId: customer.id } }),
  ]);

  const completion = {
    contact: hasText(customer.name, 2) && hasText(customer.email, 3) && hasText(customer.phone, 8),
    address: addresses.length > 0,
    payment: isRefundSettingComplete(setting),
  };
  const isComplete = completion.contact && completion.address && completion.payment;
  const nextPath = query.redirect || query.next;
  const requestedRedirect = safeInternalPath(nextPath, "/");

  return (
    <div className="account-settings-page">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <header className="user-page-hero settings-hero">
        <div>
          <span className="user-page-eyebrow"><Settings2 size={14} aria-hidden="true" /> Pengaturan akun</span>
          <h1>{query.onboarding === "1" && !isComplete ? "Selesaikan data akun Anda" : "Satu tempat untuk data akun"}</h1>
          <p>Kelola kontak, alamat pengiriman, dan rekening pengembalian dana tanpa berpindah halaman.</p>
        </div>
        <div className="account-security-note">
          <LockKeyhole size={18} aria-hidden="true" />
          <span>Data tersimpan dengan aman!</span>
        </div>
      </header>

      <div className="account-settings-stack">
        <UserContactSettingsClient
          initialContact={{
            name: customer.name,
            email: customer.email,
            phone: customer.phone || "",
          }}
          isComplete={completion.contact}
          turnstileSiteKey={turnstileSiteKey()}
        />

        <UserAddressesClient
          initialAddresses={addresses}
          turnstileSiteKey={turnstileSiteKey()}
          defaultAction={query.action}
          redirectUrl={completion.contact && completion.payment
            ? safeInternalPath(query.redirect, "")
            : undefined}
          embedded
          isComplete={completion.address}
          defaultContact={{
            name: customer.name,
            phone: customer.phone || "",
            email: customer.email,
          }}
        />

        <UserPaymentClient
          initialSetting={setting ? {
            id: setting.id,
            type: setting.type === "ewallet" ? "ewallet" : "bank",
            bankName: setting.bankName,
            bankOwnerName: setting.bankOwnerName,
            bankNumber: setting.bankNumber,
            ewalletName: setting.ewalletName,
            ewalletOwnerName: setting.ewalletOwnerName,
            ewalletNumber: setting.ewalletNumber,
          } : null}
          turnstileSiteKey={turnstileSiteKey()}
          embedded
          isComplete={completion.payment}
        />
      </div>

      {isComplete && (
        <div className="account-settings-complete">
          <div>
            <strong>Pengaturan akun sudah lengkap</strong>
            <p>Anda dapat membuat pesanan dan menyelesaikan checkout.</p>
          </div>
          <Link href={requestedRedirect} className="button button-dark">
            {requestedRedirect === "/checkout" ? "Lanjutkan checkout" : "Mulai Belanja"}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
