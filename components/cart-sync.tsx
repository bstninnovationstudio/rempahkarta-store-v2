"use client";

import { useEffect, useRef } from "react";

export function CartSync() {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    async function initSync() {
      try {
        const res = await fetch("/api/user/cart");
        if (res.status === 401) {
          // Guest mode, do nothing
          return;
        }
        if (!res.ok) return;

        const data = await res.json();
        const dbCart = data.cart || [];

        const localCart = JSON.parse(localStorage.getItem("cart") || "[]");
        const needsMerge = localStorage.getItem("cart_needs_merge") === "true";

        if (needsMerge && localCart.length > 0) {
          const mergeRes = await fetch("/api/user/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart: localCart }),
          });

          if (mergeRes.ok) {
            const mergeData = await mergeRes.json();
            isSyncingRef.current = true;
            localStorage.setItem("cart", JSON.stringify(mergeData.cart));
            localStorage.removeItem("cart_needs_merge");
            window.dispatchEvent(new Event("cart-updated"));
            isSyncingRef.current = false;
          }
        } else {
          isSyncingRef.current = true;
          localStorage.setItem("cart", JSON.stringify(dbCart));
          localStorage.removeItem("cart_needs_merge");
          window.dispatchEvent(new Event("cart-updated"));
          isSyncingRef.current = false;
        }
      } catch (error) {
        console.error("Gagal inisialisasi sinkronisasi keranjang:", error);
      }
    }

    initSync();

    async function handleCartUpdated() {
      if (isSyncingRef.current) return;

      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) return;
        const meData = await meRes.json();
        if (!meData.authenticated) return;

        const localCart = JSON.parse(localStorage.getItem("cart") || "[]");
        await fetch("/api/user/cart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: localCart }),
        });
      } catch (error) {
        console.error("Gagal mengirim sinkronisasi keranjang ke server:", error);
      }
    }

    window.addEventListener("cart-updated", handleCartUpdated);
    return () => {
      window.removeEventListener("cart-updated", handleCartUpdated);
    };
  }, []);

  return null;
}
