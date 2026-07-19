"use client";

import Link from "next/link";
import { ClipboardList, LayoutDashboard, Settings2 } from "lucide-react";
import { usePathname } from "next/navigation";

interface UserAccountNavigationProps {
  isComplete: boolean;
}

const links = [
  { href: "/user", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/user/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/user/settings", label: "Pengaturan", icon: Settings2 },
];

export function UserAccountNavigation({ isComplete }: UserAccountNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="user-sidebar-nav" aria-label="Navigasi akun">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`user-sidebar-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
            {href === "/user/settings" && !isComplete && (
              <span className="user-nav-attention" aria-label="Perlu dilengkapi">
                Lengkapi
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
