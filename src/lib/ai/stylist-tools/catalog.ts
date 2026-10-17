import type OpenAI from "openai";

export const STYLIST_TOOL_NAMES = [
  "generate_looks",
  "replace_slot",
  "visual_search",
  "combo_from_garment",
  "search_products",
  "save_to_wardrobe",
  "recall_looks",
] as const;

export type StylistToolName = (typeof STYLIST_TOOL_NAMES)[number];

export const stylistAzureTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "generate_looks",
      description:
        "Generate 2–3 shoppable look boards on the user's photo in this chat. Uses a look credit. Never tell the user to go to /generate.",
      parameters: {
        type: "object",
        properties: {
          occasion: { type: "string" },
          style: { type: "string" },
          styleType: {
            type: "string",
            description:
              "Set this from the user's named aesthetic (old money, office party, smart casual, …).",
          },
          location: { type: "string" },
          budgetMax: { type: "number" },
          lookCount: { type: "integer", enum: [2, 3] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_slot",
      description:
        "Swap one garment category in a chat-generated look and re-render the board. Uses a look credit.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          lookIndex: { type: "integer", minimum: 0, maximum: 5 },
          category: { type: "string" },
          instruction: { type: "string" },
        },
        required: ["jobId", "lookIndex", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "visual_search",
      description:
        "Find the closest shoppable matches for an attached garment photo. Results are similar items, not an identical SKU.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "combo_from_garment",
      description:
        "Build 3 shoppable looks around an attached garment photo (wardrobe-style anchor). Uses a look credit.",
      parameters: {
        type: "object",
        properties: {
          occasion: { type: "string" },
          style: { type: "string" },
          location: { type: "string" },
          budgetMax: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search verified shoppable products by text. Returns product cards with real shop URLs — no look board.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
          budgetMax: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_to_wardrobe",
      description: "Save the attached garment photo to the user's wardrobe.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_looks",
      description:
        "Recall the latest looks generated in this chat so you can call replace_slot with the correct jobId and lookIndex.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export function toolStatusMessage(name: string): string {
  switch (name) {
    case "generate_looks":
      return "Planning shoppable looks… This uses a look credit.";
    case "replace_slot":
      return "Swapping that piece and re-rendering… This uses a look credit.";
    case "visual_search":
      return "Finding closest shop matches…";
    case "combo_from_garment":
      return "Building looks around this piece… This uses a look credit.";
    case "search_products":
      return "Searching shoppable products…";
    case "save_to_wardrobe":
      return "Saving to your wardrobe…";
    case "recall_looks":
      return "Recalling your last looks…";
    default:
      return "Working…";
  }
}
