import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextMiddleware } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/explore(.*)",
  "/post/(.*)",
  "/profile/(.*)",
  "/pricing(.*)",
  "/legal(.*)",
  "/robots.txt",
  "/sitemap.xml",
  // Read-only social APIs — mutations require Clerk at middleware
  "/api/posts",
  "/api/posts/(.*)",
  "/api/profile/(.*)",
  "/api/billing/catalog(.*)",
  "/api/billing/webhook(.*)", // Razorpay — verified by HMAC signature
  "/api/inngest(.*)",  // Inngest webhook — verified by signing key, not Clerk
  "/api/health(.*)",   // Container Apps liveness/readiness probes — must be unauthenticated
  "/api/internal/index/ingest(.*)", // Scrapy batch ingest — verified by INGEST_API_KEY
]);

/** POST/PUT/PATCH/DELETE under /api/posts require auth even though GET is public. */
function isPostsMutation(req: NextRequest): boolean {
  if (!req.nextUrl.pathname.startsWith("/api/posts")) return false;
  return !["GET", "HEAD", "OPTIONS"].includes(req.method);
}

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

/** Clerk-authenticated middleware for production */
const withClerk: NextMiddleware = clerkMiddleware(async (auth, req) => {
  // Posts mutations are never public even if path matches the GET allowlist.
  if (isPublicRoute(req) && !isPostsMutation(req)) return;

  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const { userId } = await auth();

  if (userId) return;

  if (isApiRoute) {
    // Mobile / API clients get a real 401 — not Clerk's /clerk_xxx rewrite 404.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Browser pages: redirect to sign-in. Clerk requires an absolute redirect_url;
  // Safari throws "The string did not match the expected pattern" on relative ones.
  const signIn = new URL("/sign-in", req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (forwardedHost
      ? `${forwardedProto ?? "https"}://${forwardedHost}`
      : req.nextUrl.origin);
  signIn.searchParams.set(
    "redirect_url",
    `${origin}${req.nextUrl.pathname}${req.nextUrl.search}`
  );
  return NextResponse.redirect(signIn);
});

/**
 * Safety net: if Clerk key is missing in production we refuse all requests
 * rather than silently allowing everything through.
 *
 * In development without Clerk configured we allow through so local testing
 * of non-auth features still works — but we log a loud warning.
 */
const guardOrAllow: NextMiddleware = (req: NextRequest) => {
  if (process.env.NODE_ENV === "production") {
    // Hard-block in production — Clerk must be configured
    return NextResponse.json(
      { error: "Service unavailable — authentication not configured" },
      { status: 503 }
    );
  }
  // Dev open mode requires an explicit opt-in so staging never silently opens.
  if (process.env.ALLOW_UNAUTHENTICATED_DEV !== "true") {
    return NextResponse.json(
      {
        error:
          "Authentication not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY " +
          "or ALLOW_UNAUTHENTICATED_DEV=true for local-only testing.",
      },
      { status: 503 }
    );
  }
  console.warn(
    "[middleware] ALLOW_UNAUTHENTICATED_DEV=true — all routes are unprotected."
  );
  return NextResponse.next();
};

export default clerkPk ? withClerk : guardOrAllow;

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and Next.js internals.
     * The Inngest webhook path is included so we can whitelist it above.
     */
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
