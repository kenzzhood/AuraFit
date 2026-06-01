"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement>;

function SparkleIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="M5.6 5.6l2.8 2.8" />
      <path d="M15.6 15.6l2.8 2.8" />
      <path d="M5.6 18.4l2.8-2.8" />
      <path d="M15.6 8.4l2.8-2.8" />
    </svg>
  );
}

function HangerIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12 9v3" />
      <circle cx="12" cy="6.5" r="2" />
      <path d="M12 12 3 18.2c-.6.4-.3 1.3.4 1.3h17.2c.7 0 1-.9.4-1.3L12 12z" />
    </svg>
  );
}

function BookmarkIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  );
}

function ChatIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ExploreIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5 16 8l1.5 1.5L16 11l-1.5-1.5z" />
      <path d="M8 16l3.5-3.5" />
      <path d="m14.5 14.5 1.5 1.5" />
      <path d="M9 9l1.5 1.5" />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
};

const nav: NavItem[] = [
  { href: "/generate", label: "Style", icon: SparkleIcon },
  { href: "/wardrobe", label: "Wardrobe", icon: HangerIcon },
  { href: "/outfits", label: "Saved", icon: BookmarkIcon },
  { href: "/chat", label: "Stylist", icon: ChatIcon },
  { href: "/explore", label: "Explore", icon: ExploreIcon },
];

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

function isActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string | null | undefined): string {
  const match = nav.find((n) => isActive(pathname, n.href));
  return match?.label ?? "Aurafit";
}

export function PlatformChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-aura-void">
      <aside className="sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-aura-border/80 bg-aura-stage/95 px-5 py-8 backdrop-blur-md md:flex">
        <Link
          href="/generate"
          className="font-display text-base font-semibold tracking-tight text-aura-foreground"
        >
          Aurafit
        </Link>
        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.32em] text-aura-muted">
          Atelier
        </p>
        <nav className="mt-11 flex flex-1 flex-col gap-1 text-[13px]">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 font-medium transition-colors",
                  active
                    ? "border-aura-borderBright/50 bg-aura-raised/80 text-aura-champagne"
                    : "text-aura-dim hover:border-aura-border/60 hover:bg-aura-raised/40 hover:text-aura-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-aura-border pt-6">
          {clerkPk ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "ring-1 ring-aura-border",
                },
              }}
            />
          ) : (
            <Link
              href="/sign-in"
              className="text-xs text-aura-muted underline underline-offset-4"
            >
              Configure Clerk
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-aura-border bg-aura-void/95 px-4 py-3 backdrop-blur md:hidden">
          <p className="font-display text-base font-semibold text-aura-foreground">
            {pageTitle(pathname)}
          </p>
          {clerkPk ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "ring-1 ring-aura-border",
                },
              }}
            />
          ) : (
            <Link href="/sign-in" className="text-xs text-aura-dim">
              Sign in
            </Link>
          )}
        </header>

        <div className="flex-1 bg-gradient-to-b from-aura-void via-aura-stage/50 to-aura-ink px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 md:px-12 md:pb-12 md:pt-12 lg:px-16">
          {children}
        </div>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-aura-border bg-aura-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium tracking-wide transition-colors active:scale-[0.97] active:bg-aura-raised/40",
                  active ? "text-aura-champagne" : "text-aura-dim"
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-px bg-aura-champagne"
                  />
                )}
                <Icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
