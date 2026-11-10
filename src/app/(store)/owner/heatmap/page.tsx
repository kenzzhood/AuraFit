import type { Metadata } from "next";
import { getWorld } from "@/modules/runtime/world";

export const metadata: Metadata = { title: "Heatmap", robots: { index: false, follow: false } };

export default function HeatmapPage() {
  const zones = getWorld().zones;
  const max = Math.max(...zones.map((zone) => zone.count), 1);
  return (
    <main className="sheet">
      <p className="brand">AuraFit · Kasavu & Co</p>
      <h1>Foot traffic</h1>
      <p className="lead">Anonymous zone counts for the last hour. No faces, no identities.</p>
      <div className="bars">
        {zones.map((zone) => (
          <p className="bar" key={zone.zoneId}>
            {zone.zoneId}
            <i style={{ width: `${Math.round((zone.count / max) * 100)}%` }} />
            {zone.count}
          </p>
        ))}
      </div>
    </main>
  );
}
