import type { ReactNode } from "react";
import { PlatformChrome } from "@/components/layout/PlatformChrome";

export default function SocialLayout({ children }: { children: ReactNode }) {
  return <PlatformChrome>{children}</PlatformChrome>;
}
