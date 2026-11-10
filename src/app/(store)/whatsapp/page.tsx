import type { Metadata } from "next";
import { WhatsappSim } from "./whatsapp-sim";

export const metadata: Metadata = { title: "WhatsApp", robots: { index: false, follow: false } };

export default function WhatsappPage() {
  return <WhatsappSim />;
}
