import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/app/(store)", "src/design"];
const banned = [
  /#(?:7c3aed|8b5cf6|a855f7|6d28d9|5e6ad2)\b/i,
  /backdrop-filter/,
  /glassmorphism/,
  /Pay now/i,
  /Add to cart/i,
  /fair skin/i,
  /dark skin/i,
  /stock count/i,
  /\p{Extended_Pictographic}/u,
];

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx|css)$/.test(path)) out.push(path);
  }
  return out;
}

const failures = [];
for (const root of roots) {
  for (const path of files(root)) {
    const text = readFileSync(path, "utf8");
    for (const rule of banned) {
      if (rule.test(text)) failures.push(`${path} matches ${rule}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("store design audit ok");
