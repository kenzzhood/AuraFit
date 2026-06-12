import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextMiddleware } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/explore(.*)",
  "/post/(.*)",
  "/profile/(.*)",
  "/api/posts(.*)",
  "/api/profile/(.*)",
  "/api/inngest(.*)",  // Inngest webhook — verified by signing key, not Clerk
  "/api/health(.*)",   // Container Apps liveness/readiness probes — must be unauthenticated
]);

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

/** Clerk-authenticated middleware for production */
const withClerk: NextMiddleware = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const { userId } = await auth();

  if (userId) return;

  if (isApiRoute) {
    // Mobile / API clients get a real 401 — not Clerk's /clerk_xxx rewrite 404.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Browser pages: redirect to sign-in instead of protect-rewrite (404 on Azure).
  const signIn = new URL("/sign-in", req.url);
  signIn.searchParams.set(
    "redirect_url",
    req.nextUrl.pathname + req.nextUrl.search
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
  // Development: allow through but warn
  console.warn(
    "[middleware] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. " +
      "All routes are unprotected. This is only acceptable in local development."
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
