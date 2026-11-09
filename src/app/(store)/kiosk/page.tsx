import type { Metadata } from "next";
import { KioskApp } from "./kiosk-app";

export const metadata: Metadata = {
  title: "Kiosk",
  robots: { index: false, follow: false },
};

export default function KioskPage() {
  return <KioskApp mode="kiosk" />;
}
