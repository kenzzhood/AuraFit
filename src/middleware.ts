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
  if (!isPublicRoute(req)) {
    const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
    if (isApiRoute) {
      // For API routes called from mobile / non-browser clients, Clerk's
      // dev-instance "protect-rewrite" rewrites unauthenticated requests to a
      // /clerk_xxx URL that doesn't exist, producing a confusing 404 instead
      // of 401. Return a real 401 so mobile clients can prompt re-auth.
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      await auth.protect();
    }
  }
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
