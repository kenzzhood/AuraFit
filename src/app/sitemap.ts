import type { MetadataRoute } from "next";

function baseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://aurafit-web.blackstone-033a1f17.eastus2.azurecontainerapps.io";
  return raw;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const paths = [
    "/",
    "/pricing",
    "/explore",
    "/legal/privacy",
    "/legal/terms",
    "/legal/refund",
    "/legal/affiliate",
  ];
  const now = new Date();
  return paths.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
