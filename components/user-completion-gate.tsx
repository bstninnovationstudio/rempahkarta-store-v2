"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

interface UserCompletionGateProps {
  children: ReactNode;
  isComplete: boolean;
}

export function UserCompletionGate({ children, isComplete }: UserCompletionGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSettingsPage = pathname.startsWith("/user/settings");
  const queryString = searchParams.toString();

  useEffect(() => {
    if (isComplete || isSettingsPage) return;
    const returnPath = pathname.startsWith("/user")
      ? `${pathname}${queryString ? `?${queryString}` : ""}`
      : "/user";
    router.replace(`/user/settings?onboarding=1&redirect=${encodeURIComponent(returnPath)}`);
  }, [isComplete, isSettingsPage, pathname, queryString, router]);

  if (!isComplete && !isSettingsPage) {
    return (
      <div className="user-gate-loading" role="status" aria-live="polite">
        <LoaderCircle size={22} className="user-loading-icon" aria-hidden="true" />
        <strong>Menyiapkan pengaturan akun</strong>
        <p>Data kontak, alamat, dan rekening perlu dilengkapi sebelum Anda membuat pesanan.</p>
      </div>
    );
  }

  return children;
}
