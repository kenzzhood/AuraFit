import type { MetadataRoute } from "next";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://aurafit-web.blackstone-033a1f17.eastus2.azurecontainerapps.io"
  );
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/generate",
        "/chat",
        "/wardrobe",
        "/cart",
        "/billing",
        "/onboarding",
        "/dashboard",
        "/outfits",
        "/my-posts",
        "/sign-in",
        "/sign-up",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
