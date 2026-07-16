"use client";

export function CustomerLogoutButton() {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="user-sidebar-link user-logout-button"
    >
      Keluar sesi
    </button>
  );
}
