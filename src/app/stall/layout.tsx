import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@/stall/brand";

export const metadata: Metadata = {
  title: `${APP_DISPLAY_NAME} · IGDC 2026`,
  description: "Try on a look with hand gestures. InnoXR Labs at IGDC Chennai.",
};

export default function StallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="stall-kiosk fixed inset-0 z-20 overflow-hidden bg-aura-void">
      {children}
    </div>
  );
}
