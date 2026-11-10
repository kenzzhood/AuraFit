import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const colors = {
  maroon: "#6b2d3c",
  ivory: "#f3ecdf",
  green: "#1f6b4a",
  sand: "#c4a574",
  indigo: "#243e73",
  black: "#1d1d1f",
};

const audiences = ["women", "men", "child"];
const occasions = ["daily", "office", "party", "wedding", "festival", "casual"];
const palette = ["indigo", "sand", "maroon", "green", "ivory", "black"];
const fabrics = ["Cotton", "Linen", "Silk", "Handloom"];
const categories = {
  women: ["kurta", "saree", "coord", "shirt"],
  men: ["shirt", "kurta", "bandhgala", "trouser"],
  child: ["frock", "set", "kurta", "shirt"],
};
const tamil = {
  women: "பெண்கள்",
  men: "ஆண்கள்",
  child: "குழந்தை",
  daily: "தினசரி",
  office: "அலுவலகம்",
  party: "விருந்து",
  wedding: "திருமணம்",
  festival: "திருவிழா",
  casual: "சாதாரணம்",
};

const extras = [];
let n = 0;
for (const audience of audiences) {
  for (const occasion of occasions) {
    for (const color of palette) {
      n += 1;
      if (n > 48) break;
      const category = categories[audience][n % categories[audience].length];
      const price = audience === "child" ? 900 + (n % 5) * 200 : 1400 + (n % 12) * 700;
      extras.push({
        id: `sku-${String(n).padStart(2, "0")}`,
        name: `${color[0].toUpperCase()}${color.slice(1)} ${category}`,
        nameTa: `${tamil[audience]} ${tamil[occasion]}`,
        priceInr: price,
        color,
        audience,
        occasions: [occasion],
        category,
        fabric: fabrics[n % fabrics.length],
        location:
          audience === "men"
            ? "Floor 2 · Men · Rack M4"
            : audience === "child"
              ? "Floor 1 · Kids · Rack K3"
              : "Floor 1 · Daily · Rack D4",
        popularity: 1 + (n % 6),
      });
    }
    if (n > 48) break;
  }
  if (n > 48) break;
}

const dir = join(process.cwd(), "public", "catalog");
mkdirSync(dir, { recursive: true });

function svg(color, label) {
  const ink = colors[color] ?? colors.indigo;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <rect width="800" height="1000" fill="#f7f1e8"/>
  <path d="M250 180 C250 120 550 120 550 180 L620 280 L560 320 L520 260 L520 860 L280 860 L280 260 L240 320 L180 280 Z" fill="${ink}"/>
  <path d="M360 180 C360 150 440 150 440 180" fill="none" stroke="#f7f1e8" stroke-width="8"/>
  <text x="40" y="960" fill="#6e6e73" font-family="Georgia, serif" font-size="28">${label}</text>
</svg>
`;
}

const core = [
  ["kanjivaram", "maroon", "Kanjivaram"],
  ["banarasi", "ivory", "Banarasi"],
  ["temple", "green", "Temple border"],
  ["lehenga", "maroon", "Lehenga"],
  ["gown", "black", "Evening gown"],
  ["blouse-set", "sand", "Blouse set"],
  ["missing-saree", "ivory", "Tissue saree"],
  ["blue-kurta", "indigo", "Indigo kurta"],
  ["sand-kurta", "sand", "Sand kurta"],
  ["green-saree", "green", "Office saree"],
  ["formal-set", "indigo", "Formal set"],
  ["palazzo", "maroon", "Palazzo"],
  ["ivory-shirt", "ivory", "Ivory shirt"],
  ["bandhgala", "black", "Bandhgala"],
  ["sherwani", "maroon", "Sherwani"],
  ["silk-shirt", "ivory", "Silk shirt"],
  ["frock", "ivory", "Cotton frock"],
  ["kids-set", "green", "Cotton set"],
  ["kids-kurta", "sand", "Kids kurta"],
  ["swim", "indigo", "Resort set"],
];

for (const [id, color, label] of core) {
  writeFileSync(join(dir, `${id}.svg`), svg(color, label));
}
for (const item of extras) {
  writeFileSync(join(dir, `${item.id}.svg`), svg(item.color, item.name));
}

const models = join(process.cwd(), "public", "models");
mkdirSync(models, { recursive: true });
for (const id of [
  "adult-women-average-t1",
  "adult-women-average-t2",
  "adult-women-average-t3",
  "adult-men-average-t1",
  "adult-men-average-t2",
  "adult-men-average-t3",
]) {
  writeFileSync(join(models, `${id}.svg`), svg(id.includes("men") ? "indigo" : "maroon", "Model"));
}

writeFileSync(
  join(process.cwd(), "src", "modules", "catalog", "extras.json"),
  JSON.stringify(extras, null, 2)
);
console.log(`wrote ${core.length + extras.length} garments`);
