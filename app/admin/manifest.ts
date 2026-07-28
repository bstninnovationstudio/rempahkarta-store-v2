import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REMPAHKARTA Seller Center",
    short_name: "Admin Rempah",
    description: "Panel Manajemen Toko & Pesanan REMPAHKARTA",
    start_url: "/admin",
    scope: "/admin/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: "/admin-pwa.png",
        sizes: "192x192 512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/admin-pwa.png",
        sizes: "192x192 512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
