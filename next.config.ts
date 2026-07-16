import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produk dan bukti retur disimpan pada public/uploads di server aplikasi.
  images: { unoptimized: true },
};

export default nextConfig;
