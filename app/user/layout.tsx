import React from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { StoreHeader } from "@/components/store-header";
import { customerFromRequest } from "@/lib/customer-auth";
import { redirect } from "next/navigation";
import { CustomerLogoutButton } from "@/components/customer-logout-button";
import { CustomerProfileSection } from "@/components/customer-profile-section";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await customerFromRequest();
  if (!customer) {
    redirect("/login?redirect=/user");
  }

  return (
    <>
      <StoreHeader />
      <main className="user-panel-container">
        <aside className="user-sidebar">
          <CustomerProfileSection customer={{
            id: customer.id,
            name: customer.name,
            email: customer.email,
            avatarUrl: customer.avatarUrl,
            phone: customer.phone,
          }} />
          <nav className="user-sidebar-nav">
            <Link href="/user" className="user-sidebar-link">
              Ringkasan Akun
            </Link>
            <Link href="/user/orders" className="user-sidebar-link">
              Riwayat Pesanan
            </Link>
            <Link href="/user/addresses" className="user-sidebar-link">
              Buku Alamat
            </Link>
            <Link href="/user/payment" className="user-sidebar-link">
              Refund &amp; Rekening
            </Link>
            <CustomerLogoutButton />
          </nav>
        </aside>
        <section className="user-content">
          {!customer.phone && (
            <div className="account-completion-alert">
              <div className="account-completion-icon">
                <Settings size={18} />
              </div>
              <div>
                <strong>
                  Nomor WhatsApp belum dilengkapi
                </strong>
                <p>
                  Gunakan ikon gerigi pada kartu profil untuk melengkapinya agar koordinasi pengiriman lebih mudah.
                </p>
              </div>
            </div>
          )}
          {children}
        </section>
      </main>
    </>
  );
}
