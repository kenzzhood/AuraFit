import { STYLIST_TOOL_NAMES, type StylistToolName } from "./catalog";
import { handleGenerateLooks } from "./generate-looks";
import { handleReplaceSlot } from "./replace-slot";
import { handleVisualSearch } from "./visual-search";
import { handleComboFromGarment } from "./combo-from-garment";
import { handleSearchProducts } from "./search-products";
import { handleSaveToWardrobe } from "./save-to-wardrobe";
import { handleRecallLooks } from "./recall-looks";
import type { StylistToolContext, StylistToolHandler, StylistToolResult } from "./types";

const HANDLERS: Record<StylistToolName, StylistToolHandler> = {
  generate_looks: handleGenerateLooks,
  replace_slot: handleReplaceSlot,
  visual_search: handleVisualSearch,
  combo_from_garment: handleComboFromGarment,
  search_products: handleSearchProducts,
  save_to_wardrobe: handleSaveToWardrobe,
  recall_looks: handleRecallLooks,
};

export async function runStylistTool(
  name: string,
  rawArgs: string,
  ctx: StylistToolContext
): Promise<StylistToolResult> {
  if (!STYLIST_TOOL_NAMES.includes(name as StylistToolName)) {
    return { ok: false, message: `Unknown tool: ${name}` };
  }
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      const parsed = JSON.parse(rawArgs) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      return { ok: false, message: `Invalid JSON arguments for ${name}` };
    }
  }
  return HANDLERS[name as StylistToolName](ctx, args);
}
