"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function CustomerLogoutButton() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="user-sidebar-link user-logout-button"
      disabled={busy}
    >
      <LogOut size={17} aria-hidden="true" />
      <span>{busy ? "Mengakhiri sesi…" : "Keluar sesi"}</span>
    </button>
  );
}
