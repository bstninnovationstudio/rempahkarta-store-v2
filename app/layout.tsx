import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CartSync } from "@/components/cart-sync";
import { getPublicAppOrigin } from "@/lib/env";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const metadataBase = new URL(getPublicAppOrigin());

export const metadata: Metadata = {
  metadataBase,
  title: { default: "REMPAHKARTA — Rempah Pilihan Nusantara", template: "%s — REMPAHKARTA" },
  description: "Rempah pilihan dan minuman tradisional Yogyakarta dengan mutu, kebersihan, dan kesegaran yang terjaga.",
  alternates: { canonical: "/" },
  icons: { icon: "/main-logo.webp" },
  manifest: "/manifest.json",
  keywords: [
    "100% Rempah Asli Nusantara",
    "Rempah Pilihan Nusantara",
    "minuman tradisional Yogyakarta",
    "REMPAHKARTA",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "REMPAHKARTA",
    title: "REMPAHKARTA — Rempah Pilihan Nusantara",
    description: "Rempah pilihan dan minuman tradisional Yogyakarta dengan mutu, kebersihan, dan kesegaran yang terjaga.",
    images: [{ url: "/demo/banner.webp", alt: "REMPAHKARTA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "REMPAHKARTA — Rempah Pilihan Nusantara",
    description: "Rempah pilihan dan minuman tradisional Yogyakarta dengan mutu, kebersihan, dan kesegaran yang terjaga.",
    images: ["/demo/banner.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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
