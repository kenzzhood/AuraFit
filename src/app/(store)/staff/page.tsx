import type { Metadata } from "next";
import { StaffApp } from "./staff-app";

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return <StaffApp />;
}
