export interface Searchable {
  id: string;
  name: string;
  fabric: string;
  color: string;
  location: string;
}

/** Open catalogue search. No network and no paid API. */
export function searchCatalogue<T extends Searchable>(items: T[], query: string): T[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
  if (terms.length === 0) return [];
  return items
    .map((item) => {
      const haystack = `${item.name} ${item.fabric} ${item.color} ${item.location}`.toLowerCase();
      const score = terms.filter((term) => haystack.includes(term)).length;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

export function readSearchConfig() {
  return { provider: "catalogue" as const, paidApis: false as const };
}
