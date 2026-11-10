import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/s/"],
      disallow: ["/api", "/kiosk", "/staff", "/owner", "/admin"],
    },
  };
}
