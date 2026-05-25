import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { PlatformChrome } from "@/components/layout/PlatformChrome";

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (clerkPk) {
    await auth();
  }

  return <PlatformChrome>{children}</PlatformChrome>;
}
