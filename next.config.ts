import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
