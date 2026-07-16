import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CartSync } from "@/components/cart-sync";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "REMPAHKARTA — Rempah Pilihan Nusantara", template: "%s — REMPAHKARTA" },
  description: "Rempah pilihan dan minuman tradisional Yogyakarta dengan mutu, kebersihan, dan kesegaran yang terjaga.",
  icons: { icon: "/main-logo.webp" },
  manifest: "/manifest.json",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={manrope.variable}>
        {children}
        <CartSync />
      </body>
    </html>
  );
}
