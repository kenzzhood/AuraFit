import type { Metadata } from "next";
import { OwnerApp } from "./owner-app";

export const metadata: Metadata = {
  title: "Owner",
  robots: { index: false, follow: false },
};

export default function OwnerPage() {
  return <OwnerApp />;
}
