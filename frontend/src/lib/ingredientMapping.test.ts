import { describe, expect, it } from "vitest";
import { lookupMapping, upsertMapping, type IngredientMapping } from "./ingredientMapping";

const mappings: IngredientMapping[] = [
  { name: "oranges", category: "produce", store: "Smiths" },
  { name: "tomato", category: "produce", store: null },
  { name: "almond milk", category: "dairy", store: "Sam's Club" },
  { name: "rice", category: "pasta_grains", store: "Costco" },
];

describe("lookupMapping", () => {
  describe("exact match", () => {
    it("matches the stored normalized name", () => {
      expect(lookupMapping("oranges", mappings)?.store).toBe("Smiths");
      expect(lookupMapping("rice", mappings)?.category).toBe("pasta_grains");
    });

    it("normalizes whitespace and case", () => {
      expect(lookupMapping("  Oranges  ", mappings)?.store).toBe("Smiths");
      expect(lookupMapping("ALMOND MILK", mappings)?.category).toBe("dairy");
    });

    it("returns the full mapping object", () => {
      const hit = lookupMapping("almond milk", mappings);
      expect(hit).toEqual({ name: "almond milk", category: "dairy", store: "Sam's Club" });
    });
  });

  describe("plural-aware lookup", () => {
    it("matches singular input against stored plural", () => {
      // "orange" → strips s → still "orange", then adds s → "oranges" → hit
      expect(lookupMapping("orange", mappings)?.store).toBe("Smiths");
    });

    it("matches plural input against stored singular", () => {
      // "tomatoes" → strips es → "tomato" → hit
      expect(lookupMapping("tomatoes", mappings)?.category).toBe("produce");
    });

    it("does not cross-match unrelated words sharing a prefix", () => {
      // "ric" should not match "rice" (only s/es suffix variants are tried)
      expect(lookupMapping("ric", mappings)).toBeNull();
    });
  });

  describe("misses", () => {
    it("returns null when no variant matches", () => {
      expect(lookupMapping("batteries", mappings)).toBeNull();
    });

    it("returns null for empty input", () => {
      expect(lookupMapping("", mappings)).toBeNull();
      expect(lookupMapping("   ", mappings)).toBeNull();
    });

    it("returns null when mappings is empty", () => {
      expect(lookupMapping("oranges", [])).toBeNull();
    });
  });
});

describe("upsertMapping", () => {
  it("appends a new mapping when name is unseen", () => {
    const out = upsertMapping(mappings, { name: "yogurt", category: "dairy", store: "Smiths" });
    expect(out).toHaveLength(mappings.length + 1);
    expect(out[out.length - 1]).toEqual({ name: "yogurt", category: "dairy", store: "Smiths" });
  });

  it("replaces an existing entry by normalized name", () => {
    const out = upsertMapping(mappings, { name: "Oranges", category: "produce", store: "Sam's Club" });
    expect(out).toHaveLength(mappings.length);
    const hit = out.find((m) => m.name === "oranges");
    expect(hit?.store).toBe("Sam's Club");
  });

  it("normalizes whitespace and case on the stored name", () => {
    const out = upsertMapping([], { name: "  YOGURT  ", category: "dairy", store: null });
    expect(out[0].name).toBe("yogurt");
  });

  it("does not mutate the input array", () => {
    const before = mappings.slice();
    upsertMapping(mappings, { name: "yogurt", category: "dairy", store: null });
    expect(mappings).toEqual(before);
  });
});
