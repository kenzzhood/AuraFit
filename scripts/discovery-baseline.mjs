#!/usr/bin/env node
/**
 * Score the committed eval set against a fixture catalogue.
 * Does not call SerpAPI, Google, or the crawler.
 *
 * Current (v1) rules mirrored here:
 * - a missing gender is treated as male
 * - a result must share the query category
 * - budget is a hard max
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const queries = JSON.parse(
  readFileSync(join(root, "evals/discovery/queries.json"), "utf8")
).queries;
const products = JSON.parse(
  readFileSync(join(root, "evals/discovery/fixture-catalogue.json"), "utf8")
).products;

function audience(gender) {
  if (gender === "female" || gender === "male" || gender === "unisex") return gender;
  return "male";
}

function matches(query, product) {
  if (product.category !== query.category) return false;
  if (product.priceInr > query.budgetMax) return false;
  const want = audience(query.gender);
  if (want === "unisex") return true;
  return product.gender === want || product.gender === "unisex";
}

const hostCounts = [];
const wrongGender = [];
let empty = 0;
const storeImpressions = {};
let impressions = 0;

for (const query of queries) {
  const hits = products.filter((product) => matches(query, product)).slice(0, 20);
  const hosts = new Set(hits.map((product) => product.host));
  hostCounts.push(hosts.size);
  if (hits.length === 0) empty += 1;
  const asked = query.gender;
  if (asked === "female" || asked === "male") {
    if (hits.some((product) => product.gender !== asked && product.gender !== "unisex")) {
      wrongGender.push(query.id);
    }
  }
  for (const product of hits) {
    impressions += 1;
    storeImpressions[product.host] = (storeImpressions[product.host] ?? 0) + 1;
  }
}

hostCounts.sort((a, b) => a - b);
const medianHosts = hostCounts[Math.floor(hostCounts.length / 2)] ?? 0;
const topStore = Object.entries(storeImpressions).sort((a, b) => b[1] - a[1])[0];
const topShare =
  impressions === 0 || !topStore ? 0 : Math.round((topStore[1] / impressions) * 1000) / 10;

const lines = [
  "# Discovery baseline",
  "",
  "Measured on the committed fixture catalogue. This run does not call SerpAPI, Google, or the crawler.",
  "",
  "Production dead-click rate, host diversity, and store impression share are not in this file. Those numbers start once `DiscoveryLog` rows exist.",
  "",
  `| Metric | Value |`,
  `| --- | --- |`,
  `| Queries | ${queries.length} |`,
  `| Fixture products | ${products.length} |`,
  `| Empty results | ${empty} |`,
  `| Median distinct hosts in a result | ${medianHosts} |`,
  `| Wrong-gender results | ${wrongGender.length} |`,
  `| Largest store share of fixture impressions | ${topStore ? `${topStore[0]} ${topShare}%` : "n/a"} |`,
  "",
  "v1 matching treats a missing gender as male and keeps only the query category under the budget cap.",
  "",
];

const out = join(root, "docs/baseline-metrics.md");
writeFileSync(out, lines.join("\n"));
console.log(lines.join("\n"));
