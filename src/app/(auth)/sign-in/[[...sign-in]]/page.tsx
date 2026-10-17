import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Link from "next/link";
import { GridPattern } from "@/components/ui/grid-pattern";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export default function SignInPage() {
  if (!clerkPk) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-aura-void px-4 text-center">
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark opacity-50" />
        <GridPattern className="opacity-40" />
        <p className="relative z-10 max-w-md text-sm text-aura-dim">
          Clerk is not configured. Copy{" "}
          <code className="rounded border border-aura-border bg-aura-surface px-1.5 py-0.5 text-aura-champagne">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded border border-aura-border bg-aura-surface px-1.5 py-0.5 text-aura-champagne">
            .env.local
          </code>{" "}
          and add your publishable + secret keys.
        </p>
        <Link
          href="/"
          className="relative z-10 text-sm text-aura-champagne underline-offset-4 hover:underline"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-aura-void px-4">
      <div className="pointer-events-none absolute inset-0 bg-mesh-dark opacity-60" />
      <GridPattern className="opacity-30" />
      <div className="relative z-10 w-full max-w-md">
        <SignIn
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#e8c4a0",
              colorText: "#fafafa",
              colorTextSecondary: "#a1a1aa",
              colorBackground: "#0c0c0f",
              colorInputBackground: "#121218",
              colorInputText: "#fafafa",
              borderRadius: "0.75rem",
            },
            elements: {
              rootBox: "mx-auto w-full",
              card: "border border-aura-border bg-aura-surface/95 shadow-2xl shadow-black/40 backdrop-blur-xl",
              headerTitle: "font-display text-2xl",
              formButtonPrimary:
                "bg-gradient-to-r from-aura-champagne to-aura-gold text-aura-void font-semibold",
              footerActionLink: "text-aura-champagne hover:text-aura-gold",
              identityPreviewText: "text-aura-foreground",
            },
          }}
        />
      </div>
    </div>
  );
}
