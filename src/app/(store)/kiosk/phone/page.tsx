import type { Metadata } from "next";
import { KioskApp } from "../kiosk-app";

export const metadata: Metadata = {
  title: "Phone",
  robots: { index: false, follow: false },
};

export default function PhonePage() {
  return <KioskApp mode="phone" />;
}
