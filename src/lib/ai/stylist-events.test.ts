import { describe, expect, it } from "vitest";
import {
  createNdjsonParser,
  encodeNdjson,
  parseNdjsonLine,
  type StylistNdjsonEvent,
} from "./stylist-events";

const samples: StylistNdjsonEvent[] = [
  { type: "text", delta: "Hello" },
  { type: "status", message: "Searching…" },
  { type: "looks", jobId: "job_1", status: "queued" },
  {
    type: "products",
    products: [
      {
        title: "Navy blazer",
        productUrl: "https://www.myntra.com/p/1",
        source: "myntra",
        matchCategory: "outerwear",
      },
    ],
  },
  { type: "error", message: "Quota exceeded" },
];

describe("parseNdjsonLine", () => {
  it("parses all five event types", () => {
    for (const event of samples) {
      expect(parseNdjsonLine(JSON.stringify(event))).toEqual(event);
    }
  });

  it("returns null for empty or invalid lines", () => {
    expect(parseNdjsonLine("")).toBeNull();
    expect(parseNdjsonLine("{not json")).toBeNull();
    expect(parseNdjsonLine(JSON.stringify({ type: "nope" }))).toBeNull();
  });
});

describe("createNdjsonParser", () => {
  it("buffers incomplete lines and flushes leftovers", () => {
    const parser = createNdjsonParser();
    const first = encodeNdjson(samples[0]!);
    const mid = first.slice(0, 8);
    const rest = first.slice(8);
    expect(parser.push(mid)).toEqual([]);
    expect(parser.push(rest)).toEqual([samples[0]]);
    parser.push(JSON.stringify(samples[1]!));
    expect(parser.flush()).toEqual([samples[1]]);
  });
});
