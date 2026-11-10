import type { Metadata } from "next";
import { CORE_MODEL_IDS } from "@/modules/generation";
import { seedLooks } from "@/modules/runtime/world";

export const metadata: Metadata = { title: "Renders", robots: { index: false, follow: false } };

export default function RendersPage() {
  const looks = seedLooks();
  return (
    <main className="sheet">
      <p className="brand">AuraFit</p>
      <h1>Overnight renders</h1>
      <p className="lead">Six core models are ready. The rest wait until the shop is closed.</p>
      <h2>Core, done</h2>
      <ul>
        {CORE_MODEL_IDS.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      <h2>Queued</h2>
      <p className="lead">{looks.length} styles still walk the rest of the 18 models after close.</p>
    </main>
  );
}
