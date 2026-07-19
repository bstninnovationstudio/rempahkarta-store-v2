"use client";

import Link from "next/link";
import Image from "next/image";
import { Settings2 } from "lucide-react";
import { useState } from "react";

interface Customer {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
}

interface CustomerProfileSectionProps {
  customer: Customer;
}

export function CustomerProfileSection({ customer }: CustomerProfileSectionProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="profile-section-wrapper">
      <div className="profile-section-left" aria-hidden="true">
        {customer.avatarUrl && !avatarFailed ? (
          <Image
            src={customer.avatarUrl}
            alt=""
            width={46}
            height={46}
            unoptimized
            className="profile-section-avatar"
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <div className="profile-section-initials">
            {customer.name[0]?.toUpperCase() || "R"}
          </div>
        )}
      </div>
      <div className="profile-section-center">
        <span>Akun saya</span>
        <h3>{customer.name}</h3>
        <p>{customer.email}</p>
      </div>
      <Link
        href="/user/settings#contact"
        className="profile-edit-btn"
        title="Buka pengaturan akun"
        aria-label="Buka pengaturan akun"
      >
        <Settings2 size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}
