import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + Clerk + PostHog + Sentry
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.accounts.dev https://*.clerk.accounts.dev https://app.posthog.com https://browser.sentry-cdn.com",
      // Styles: self + Google Fonts + inline (Clerk)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + CDN sources
      "img-src 'self' blob: data: https://res.cloudinary.com https://*.blob.core.windows.net https://*.azureedge.net https://img.clerk.com https://images.unsplash.com",
      // Connections: self + services
      "connect-src 'self' https://*.clerk.accounts.dev https://clerk.accounts.dev https://app.posthog.com https://*.sentry.io wss://*.clerk.accounts.dev",
      // Frames: Clerk OAuth
      "frame-src 'self' https://accounts.google.com https://*.clerk.accounts.dev",
      // Workers
      "worker-src 'self' blob:",
    ]
      .filter(Boolean)
      .join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
      {
        protocol: "https",
        hostname: "*.azureedge.net",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: isDev
        ? ["localhost:3000", "localhost:8081"]
        : [process.env.NEXT_PUBLIC_APP_URL ?? "https://app.aurafit.com"].filter(
            Boolean
          ),
    },
  },
};

export default nextConfig;
