import { describe, expect, it } from "vitest";
import { STYLIST_TOOL_NAMES, stylistAzureTools } from "./catalog";
import { MAX_TOOL_ROUNDS } from "../stylist";

describe("stylist tool catalog", () => {
  it("exports seven tool names", () => {
    expect(STYLIST_TOOL_NAMES).toEqual([
      "generate_looks",
      "replace_slot",
      "visual_search",
      "combo_from_garment",
      "search_products",
      "save_to_wardrobe",
      "recall_looks",
    ]);
    expect(STYLIST_TOOL_NAMES).toHaveLength(7);
  });

  it("keeps MAX_TOOL_ROUNDS at 4", () => {
    expect(MAX_TOOL_ROUNDS).toBe(4);
  });

  it("adds styleType to generate_looks and keeps lookCount at 2|3", () => {
    const tool = stylistAzureTools.find(
      (t) => t.type === "function" && t.function.name === "generate_looks"
    );
    expect(tool?.type).toBe("function");
    if (tool?.type !== "function") return;
    const props = tool.function.parameters?.properties as
      | Record<string, { type?: string; enum?: number[] }>
      | undefined;
    expect(props?.styleType?.type).toBe("string");
    expect(props?.lookCount?.enum).toEqual([2, 3]);
  });
});
