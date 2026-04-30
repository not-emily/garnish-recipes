import type { IngredientMapping } from "@/types/grocery";

export type { IngredientMapping };

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// Singular/plural variants tried, in order, against stored mapping names.
// Mirrors the (?:es|s)? tolerance in categorize.ts so the lookup matches
// either form regardless of how the ingredient was originally saved.
function variants(normalized: string): string[] {
  const out = [normalized];
  if (normalized.endsWith("es")) out.push(normalized.slice(0, -2));
  if (normalized.endsWith("s")) out.push(normalized.slice(0, -1));
  out.push(`${normalized}s`);
  out.push(`${normalized}es`);
  return out;
}

export function lookupMapping(
  name: string,
  mappings: IngredientMapping[],
): IngredientMapping | null {
  const normalized = normalize(name);
  if (!normalized) return null;
  const index = new Map(mappings.map((m) => [m.name, m]));
  for (const v of variants(normalized)) {
    const hit = index.get(v);
    if (hit) return hit;
  }
  return null;
}

// Returns a new array with the mapping for `name` set to the given values.
// Replaces an existing entry by normalized name, or appends a new one.
// Mirrors the backend's find_or_initialize_by + save semantics so the cache
// stays in sync with the DB after a successful add_item or update_item.
export function upsertMapping(
  mappings: IngredientMapping[],
  next: IngredientMapping,
): IngredientMapping[] {
  const key = normalize(next.name);
  const normalized: IngredientMapping = { ...next, name: key };
  const idx = mappings.findIndex((m) => m.name === key);
  if (idx === -1) return [...mappings, normalized];
  const out = mappings.slice();
  out[idx] = normalized;
  return out;
}
