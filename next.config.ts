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
      // Clerk (dev + production) + analytics
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.accounts.dev https://*.clerk.com https://clerk.com https://challenges.cloudflare.com https://app.posthog.com https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://*.clerk.com",
      "font-src 'self' https://fonts.gstatic.com https://*.clerk.accounts.dev https://*.clerk.com",
      "img-src 'self' blob: data: https://res.cloudinary.com https://*.blob.core.windows.net https://*.azureedge.net https://img.clerk.com https://images.unsplash.com",
      "connect-src 'self' https://*.clerk.accounts.dev https://clerk.accounts.dev https://*.clerk.com https://clerk.com wss://*.clerk.accounts.dev wss://*.clerk.com https://clerk-telemetry.com https://app.posthog.com https://*.sentry.io",
      "frame-src 'self' https://accounts.google.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
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
