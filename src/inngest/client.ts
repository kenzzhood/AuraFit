import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "aurafit", name: "Aurafit" });

export const GENERATION_EVENT = "aurafit/generation.requested" as const;
