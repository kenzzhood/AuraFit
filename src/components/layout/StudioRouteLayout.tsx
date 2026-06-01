import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { PlatformChrome } from "@/components/layout/PlatformChrome";
import { OnboardingGate } from "@/components/layout/OnboardingGate";

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export default async function StudioRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (clerkPk) {
    await auth();
  }

  return (
    <PlatformChrome>
      <OnboardingGate>{children}</OnboardingGate>
    </PlatformChrome>
  );
}
