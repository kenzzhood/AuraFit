import type { ReactNode } from "react";
import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export default function SocialLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-aura-void">
      <header className="sticky top-0 z-40 border-b border-aura-border/60 bg-aura-void/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3.5 md:px-12">
          <Link
            href="/explore"
            className="font-display text-base font-semibold text-aura-foreground"
          >
            Aurafit
            <span className="ml-2 text-[10px] font-body font-medium uppercase tracking-[0.28em] text-aura-muted">
              Atelier
            </span>
          </Link>
          <div className="flex items-center gap-6 text-[13px] font-medium text-aura-dim">
            <Link
              href="/explore"
              className="transition-colors hover:text-aura-champagne"
            >
              Explore
            </Link>
            <Link
              href="/dashboard"
              className="transition-colors hover:text-aura-champagne"
            >
              Studio
            </Link>
            {clerkPk ? (
              <>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="rounded-sm border border-aura-border px-4 py-2 text-xs font-medium text-aura-foreground transition-colors hover:border-aura-champagne/35"
                    >
                      Sign in
                    </button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="text-xs text-aura-muted underline underline-offset-4"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-12 md:py-14">
        {children}
      </main>
    </div>
  );
}
