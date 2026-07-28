import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Content-Security-Policy", value: [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://accounts.google.com https://challenges.cloudflare.com`,
    "script-src-elem 'self' 'unsafe-inline' https://accounts.google.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    `connect-src 'self'${process.env.NODE_ENV === "production" ? "" : " ws: wss:"} https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://challenges.cloudflare.com`,
    "frame-src https://accounts.google.com https://challenges.cloudflare.com",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ") },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Gambar produk publik dilayani langsung; bukti retur/refund memakai route
  // terautentikasi dari storage/private dan tidak melewati Next Image.
  images: { unoptimized: true },
  poweredByHeader: false,
  env: {
    // Expose APP_MODE ke client components sebagai NEXT_PUBLIC_APP_MODE.
    // Cukup set APP_MODE di .env; nilai ini otomatis tersedia di browser.
    NEXT_PUBLIC_APP_MODE: process.env.APP_MODE || "development",
  },
  async headers() {
    const privateApiHeaders = [{
      key: "Cache-Control",
      value: "private, no-store, max-age=0, must-revalidate",
    }];
    return [
      { source: "/api/auth/:path*", headers: privateApiHeaders },
      { source: "/api/user/:path*", headers: privateApiHeaders },
      { source: "/api/orders/:path*", headers: privateApiHeaders },
      { source: "/api/returns/:path*", headers: privateApiHeaders },
      { source: "/api/admin/:path*", headers: privateApiHeaders },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
