import {
  availabilityText,
  toPublicLook,
  type Audience,
  type BudgetBand,
  type Look,
  type Occasion,
  type PublicLook,
} from "@/modules/shared/types";
import type { ToneCode } from "@/modules/vision";

const TONE_COLORS: Record<ToneCode, string[]> = {
  t1: ["ivory", "sand"],
  t2: ["indigo", "green"],
  t3: ["maroon", "black"],
};

export interface RecommendQuery {
  audience: Audience;
  occasion: Occasion;
  budget: BudgetBand;
  color: string | null;
  tone: ToneCode | null;
}

export interface ScoredLook {
  look: Look;
  score: number;
  factors: string[];
}

export function scoreLook(look: Look, query: RecommendQuery): ScoredLook {
  const factors: string[] = [];
  let score = 0;
  if (look.occasions.includes(query.occasion)) {
    score += 0.35;
    factors.push("occasion");
  }
  if (query.color && look.color === query.color) {
    score += 0.15;
    factors.push("colour");
  }
  if (query.tone && TONE_COLORS[query.tone].includes(look.color)) {
    score += 0.15;
    factors.push("tone_compat");
  }
  score += Math.min(look.popularity, 10) / 10 * 0.15;
  factors.push("popularity");
  if (look.priority > 0) {
    score += 0.15;
    factors.push("store_priority");
  }
  if (look.availability === "available") score += 0.1;
  else if (look.availability === "likely") score += 0.05;
  return { look, score, factors };
}

function mmr(pool: ScoredLook[], count: number): ScoredLook[] {
  const remaining = [...pool].sort((a, b) => b.score - a.score);
  const picked: ScoredLook[] = [];
  while (picked.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const repeated = picked.some((item) => item.look.color === candidate.look.color);
      const value = candidate.score - (repeated ? 0.2 : 0);
      if (value > bestScore) {
        bestScore = value;
        bestIndex = index;
      }
    }
    picked.push(remaining.splice(bestIndex, 1)[0]);
  }
  return picked;
}

export function recommend(
  looks: Look[],
  query: RecommendQuery
): { looks: PublicLook[]; debug: { id: string; factors: string[] }[] } {
  const matching = looks.filter(
    (look) =>
      look.audience === query.audience &&
      look.occasions.includes(query.occasion) &&
      look.budget === query.budget
  );
  const scored = matching.map((look) => scoreLook(look, query));
  const primary = scored.filter((item) => item.look.availability !== "ask_staff");
  const backup = scored.filter((item) => item.look.availability === "ask_staff");
  let picked = mmr(primary, 8);
  const promoted = picked.filter((item) => item.look.priority > 0);
  if (promoted.length > 2) {
    const drop = new Set(
      promoted
        .sort((a, b) => a.score - b.score)
        .slice(0, promoted.length - 2)
        .map((item) => item.look.id)
    );
    picked = picked.filter((item) => !drop.has(item.look.id));
  }
  if (picked.length < 6) {
    picked = picked.concat(mmr(backup, 6 - picked.length));
  }
  picked = picked.slice(0, 6);
  if (picked[0]?.look.availability === "ask_staff") {
    const replacement = picked.findIndex((item) => item.look.availability !== "ask_staff");
    if (replacement > 0) {
      const [better] = picked.splice(replacement, 1);
      picked.unshift(better);
    } else if (replacement === -1) {
      picked.shift();
    }
  }
  return {
    looks: picked.map((item) => toPublicLook(item.look)),
    debug: picked.map((item) => ({ id: item.look.id, factors: item.factors })),
  };
}

export function publicReason(factors: string[]): string {
  const visible = factors.filter((factor) => factor !== "tone_compat");
  if (visible.includes("occasion")) return "Matches this occasion and what the store has.";
  return "From this store's current floor.";
}

export function assertNoToneLanguage(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const banned of ["fair", "dark", "skin", "tone_compat", "\"t1\"", "\"t2\"", "\"t3\""]) {
    if (text.includes(banned)) {
      throw new Error(`public payload contains ${banned}`);
    }
  }
}

export function withAvailability(look: Look): Look {
  return { ...look, availabilityText: availabilityText(look.availability) };
}
