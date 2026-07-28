import type { MetadataRoute } from "next";
import { getPublicAppOrigin } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/admin/*",
        "/admin-login",
        "/admin-login/",
        "/api/",
        "/cart",
        "/checkout",
        "/login",
        "/orders/",
        "/user/",
      ],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
