import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, ShieldAlert, ShieldCheck, PauseCircle } from "lucide-react";
import { StoreHeader } from "@/components/store-header";
import { customerFromRequest } from "@/lib/customer-auth";
import { redirect } from "next/navigation";
import { CustomerLogoutButton } from "@/components/customer-logout-button";
import { CustomerProfileSection } from "@/components/customer-profile-section";
import { UserAccountNavigation } from "@/components/user-account-navigation";
import { UserCompletionGate } from "@/components/user-completion-gate";
import { getProfileCompleteness } from "@/lib/user-profile";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await customerFromRequest();
  if (!customer) {
    redirect("/login?redirect=/user");
  }

  const profileCompletion = await getProfileCompleteness(customer.id);
  const isComplete = profileCompletion.isComplete;
  const missingLabels = [
    !profileCompletion.sections.contact && "kontak utama",
    !profileCompletion.sections.address && "alamat pengiriman",
    !profileCompletion.sections.refundAccount && "rekening pengembalian dana",
  ].filter(Boolean) as string[];

  return (
    <div className="user-panel-page">
      <StoreHeader />
      <main className="user-panel-container">
        <aside className="user-sidebar" aria-label="Menu akun">
          <CustomerProfileSection customer={{
            id: customer.id,
            name: customer.name,
            email: customer.email,
            avatarUrl: customer.avatarUrl,
            phone: customer.phone,
          }} />
          <UserAccountNavigation isComplete={isComplete} />
          <div className={`user-sidebar-status ${isComplete ? "complete" : "incomplete"}`}>
            {isComplete ? (
              <ShieldCheck size={16} aria-hidden="true" />
            ) : (
              <ShieldAlert size={16} aria-hidden="true" />
            )}
            <div>
              <strong>{isComplete ? "Akun siap digunakan" : "Akun belum lengkap"}</strong>
              <span>{isComplete ? "Data wajib sudah tersimpan." : `${missingLabels.length} bagian perlu dilengkapi.`}</span>
            </div>
          </div>
          <div className="user-sidebar-session">
            <CustomerLogoutButton />
          </div>
        </aside>
        <section className="user-content">
          {customer.status === "PAUSE" && (
            <div className="account-paused-alert">
              <div className="account-paused-icon">
                <PauseCircle size={20} aria-hidden="true" />
              </div>
              <div className="account-paused-copy">
                <strong>Akun Anda Sedang Dijeda</strong>
                <p>
                  Akun anda sedang dijeda oleh karena aktifitas mencurigakan dan sedang dalam peninjauan lebih lanjut.
                </p>
              </div>
            </div>
          )}
          {!isComplete && (
            <div className="account-completion-alert">
              <div className="account-completion-icon">
                <AlertCircle size={19} aria-hidden="true" />
              </div>
              <div className="account-completion-copy">
                <strong>Lengkapi akun sebelum membuat pesanan</strong>
                <p>
                  Masih diperlukan: {missingLabels.join(", ")}. Data ini membantu checkout, pengiriman, dan refund berjalan tanpa hambatan.
                </p>
              </div>
              <Link href="/user/settings?onboarding=1" className="account-completion-link">
                Lengkapi sekarang <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
          <UserCompletionGate isComplete={isComplete}>{children}</UserCompletionGate>
        </section>
      </main>
    </div>
  );
}
