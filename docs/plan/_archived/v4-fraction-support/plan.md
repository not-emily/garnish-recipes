# Fraction Support for Ingredient Quantities

> **Status:** Planning complete | Last updated: 2026-04-29
>
> Phase files: [phases/](phases/)

## Overview

A small, focused initiative driven by a single recurring complaint: ingredient quantities like `1¾ cup` round-trip through the app as `1.75 cup` (or get rendered as `1.8 cup` after numeric formatting). For a meal-planning app, this reads as broken — nobody measures `1.75 cup` of flour, they measure `1¾ cup`. The fix is display-side: store the same decimal we already store, render it as a fraction when the unit suggests one (cup, tsp, tbsp, etc.), and accept fraction input via a parser.

The work is bounded — one weekend, one phase, three steps — but touches every surface where an ingredient quantity appears: the recipe editor, recipe detail pages, the public shared-recipe page, and the grocery list.

The design is also forward-compatible with the imported-recipe-parsing backlog item. The parser shape (TypeScript first, with a comprehensive test suite that doubles as a spec) anticipates a future Ruby port that handles scraped quantity tokens like `"2 1/2"` from JSON-LD or LLM ingestion output.

## Core Vision

- **Convention wins over intent**: Unit class drives formatting (cup → fraction, gram → decimal). Users don't choose the format; the app picks the natural one for the unit. Less surface, fewer edge cases.
- **Snap to real measuring tools**: Halves, thirds, quarters, eighths. These match the measuring cups and spoons people actually own; nobody has a 1/16th teaspoon.
- **Storage stays decimal, display becomes the human form**: One number in JSONB, format on render. No new fields, no migrations, no per-ingredient format hint.
- **Parser is the spec**: A single utility with comprehensive tests serves as a contract — both for input validation today and for the imported-recipe Ruby parser later.

## Requirements

### Must Have

- Parser utility `parseQuantity(text) → number | null` accepting:
  - Integers, decimals, ascii fractions (`3/4`), mixed fractions (`1 3/4`), hyphenated mixed (`1-3/4`), unicode vulgar fractions (`¾`, `1¾`, `1 ¾`), and loose spacing (`3 / 4`)
  - Returns `null` for invalid (empty, `abc`, `1/0`, `1//2`, `1.2.3`)
- Formatter utility `formatQuantity(decimal, unit) → string` with unit-class routing:
  - **Fractional units** (cup, tsp, tbsp, clove(s), can(s), pinch, dash, package, no-unit) → snap to halves/thirds/quarters/eighths within tolerance ~0.02; decimal fallback outside tolerance
  - **Decimal units** (g, kg, oz, lb, lbs, ml, l) → decimal, ≤ 2 places, trailing zeros trimmed
  - Glyphs are unicode (`½ ⅓ ¼ ⅔ ¾ ⅛ ⅜ ⅝`)
- Quantity input surfaces (all use the same parser-driven validation + unit-aware chip row):
  - `IngredientEditor.tsx` — recipe editor's per-ingredient qty field
  - `GroceryList.tsx` `EditItemModal` — edit existing grocery item
  - `GroceryList.tsx` `AddItemForm` — add new grocery item
  - All three: switch from numeric/decimal input to `<input type="text" inputMode="text">`; validate via `parseQuantity` on blur; show error border on invalid; render `FractionChipRow` when focused AND `unitClass(unit) === "fractional"`
- Display surfaces routing all quantities through `formatQuantity`:
  - `RecipeDetail.tsx` — ingredients list (lines 486-490)
  - `SharedRecipe.tsx` — `formatIngredient` helper (line 252)
  - `GroceryList.tsx` — `formatItemLabel` helper (line 759-761), including aggregated quantities returned by `GroceryGenerator`
- Test suite covers all parser branches, formatter snap behavior, both unit classes, and edge cases — and serves as the spec for the future Ruby port

### Nice to Have

- Live-validation visual on the quantity input (border tint changes as the user types, not just on blur)
- Format-preview hint near the input as the user types (e.g., `0.5` shows `→ ½`)

### Out of Scope

- `quantity_format` hint to preserve user intent — convention wins; no extra JSONB fields
- Two-field input (integer + fraction dropdown) — single field with chip row chosen
- Popover-triggered fraction picker — focus-triggered chip row chosen
- Imported recipe ingredient parsing (separate backlog item; the Ruby port of `parseQuantity` lives there)
- Ingredient name/unit splitting from imported text — separate backlog item
- Unit conversion (e.g., showing tablespoons as fluid ounces) — separate concern
- Per-household preference for fraction vs. decimal — convention wins
- Quantity range support (`"1-2 tablespoons"`) — needs a different storage shape; out of scope

## Constraints

- **Tech stack**: Existing (React 19 + TypeScript + Vite frontend; Rails 8 + PostgreSQL backend). No new dependencies.
- **Storage**: `quantity` stays as `number` inside the JSONB ingredients column. No migrations.
- **Backend**: `GroceryGenerator` already does `to_f * scale` — unchanged. Aggregated quantities flow back as decimals; the frontend formats them.
- **Team**: Solo developer, off-hours cadence
- **Sequencing**: One phase, three internal steps that must run in dependency order (utility → editor → display)

## Success Metrics

- `1.75 cup flour` displays as `1¾ cup flour` on RecipeDetail, SharedRecipe, and the GroceryList
- `355 g sugar` displays as `355 g sugar` (no fractional snap on weight units)
- `0.333 cup` displays as `⅓ cup` (within snap tolerance)
- User can type `1 3/4` directly into any quantity input (recipe editor or grocery item) and see the underlying value stored as `1.75` after blur
- User can tap `¾` in the chip row to insert the glyph without using the keyboard `/`
- Chip row hides automatically when the user types a decimal-class unit like `g` or `lb`
- Aggregating two `0.333 cup` contributions on the grocery list renders as `⅔ cup`
- Invalid input (`abc`, `1//2`) shows an inline error and blocks save
- All `parseQuantity` and `formatQuantity` test cases pass; `npm run build` succeeds

## Architecture Decisions

### 1. Display-Only Formatting, Decimal Storage
**Choice:** `quantity` stays as `number` in JSONB. No additional fields. Format at render time, parse at input time.
**Rationale:** Adds zero new surface area to backend or migrations. The "user typed X but we stored Y" gap is invisible — they always see the natural format for the unit. Aggregation, scaling, and storage logic all stay decimal-native.
**Trade-offs:** Round-trip fidelity is imperfect for fractions like `⅓` (stored as `0.333…`). Mitigated by aggressive snap tolerance — `0.333` reliably renders back as `⅓`.

### 2. Unit-Class Drives Formatting
**Choice:** A small classifier maps unit strings to one of two display modes — `fractional` (cup, tsp, tbsp, clove, can, pinch, dash, package, no-unit) or `decimal` (g, kg, oz, lb, lbs, ml, l).
**Rationale:** Real-world measuring tools dictate the natural format. Fractional measuring cups for volumes; digital scales for weights. A single universal format is wrong half the time.
**Trade-offs:** Edge units not in the classifier (`bunch`, `head`, `slice`, etc.) default to fractional, which matches their typical use. If a niche use case wants the opposite, a one-line classifier tweak handles it.

### 3. Aggressive Snap Tolerance
**Choice:** When formatting a fractional-unit quantity, snap to the nearest halves/thirds/quarters/eighths denominator within ~0.02 absolute tolerance. Outside tolerance, fall back to decimal (≤ 2 places, trimmed).
**Rationale:** People measure with halves, thirds, quarters, and eighths — not sixteenths or sixty-fourths. Aggressive snapping makes scaled and aggregated quantities (`2.625` from doubling `1¾`) look natural (`2⅝`).
**Trade-offs:** A user-typed value close to a "nice" fraction but not exact (e.g., `0.32`) gets snapped to `⅓`. Acceptable — the precision loss is below the precision people actually use in the kitchen.

### 4. Single Text Field + Unit-Aware Chip Row
**Choice:** Quantity input is a plain text field (`<input type="text" inputMode="text">`) accepting parser-supported syntax (integers, decimals, fractions, unicode). A row of unicode-fraction chips appears below the input when **focused AND the unit is fractional-class (or empty)**. Tapping a chip inserts or replaces the fractional portion. Row hides on blur or when the unit becomes decimal-class.
**Rationale:** Single source of truth for input; paste-from-recipe works (`1 1/2` and `1½` both parse); decimals work natively (`1.5`); mobile users get fast tap-to-insert without hunting for `/` on iOS keyboards. Tying chip visibility to unit class makes the affordance a UI signal — chips appear exactly when fractions make sense — and avoids tempting users to produce `355½ g` nonsense.
**Trade-offs:** Active editing has one extra UI element (a row of 8 small chips). Acceptable — only present during focus on a fractional-unit field, and replaces a real friction point on iOS.

### 5. Parser is the Spec
**Choice:** Build `parseQuantity` and `formatQuantity` in TypeScript with an exhaustive test suite. Treat the test cases as the canonical specification. When the imported-recipe-parsing backlog item is picked up later, port the same algorithm to Ruby and reuse the same test cases.
**Rationale:** Two implementations of the same parser is acceptable for a polyglot stack; divergence is the risk. Treating the test suite as the spec eliminates that risk — any difference between TS and Ruby shows up as a failing test in either.
**Trade-offs:** Slight upfront effort to write comprehensive tests now. Pays back when the Ruby port lands and again whenever either parser changes.

## Project Structure

No new top-level directories. All changes are inside `frontend/`:

```
frontend/
├── src/
│   ├── lib/
│   │   ├── quantity.ts                # NEW: parser, formatter, unit classifier
│   │   └── quantity.test.ts           # NEW: full test suite (the spec)
│   ├── components/
│   │   └── recipes/
│   │       ├── IngredientEditor.tsx   # MODIFIED: text input, validation, chip row integration
│   │       └── FractionChipRow.tsx    # NEW: focus-triggered chip row component
│   └── pages/
│       ├── RecipeDetail.tsx           # MODIFIED: route quantities through formatQuantity
│       ├── SharedRecipe.tsx           # MODIFIED: same
│       └── GroceryList.tsx            # MODIFIED: same
```

### Key Files
- `frontend/src/lib/quantity.ts` — single source of truth for parsing and formatting; the spec lives in its tests
- `frontend/src/components/recipes/IngredientEditor.tsx` — primary input surface
- `frontend/src/components/recipes/FractionChipRow.tsx` — mobile-friendly tap-to-insert UI
- `frontend/src/pages/GroceryList.tsx` — display surface for aggregated quantities (where decimal weirdness is most visible after grocery generation)

## Core Interfaces

### Parser

```typescript
/**
 * Parse a user- or scraper-produced quantity string into a decimal number.
 * Returns null for invalid input (including empty string).
 */
function parseQuantity(text: string): number | null;

// Accepts:
//   "3"            → 3
//   "1.5"          → 1.5
//   "3/4"          → 0.75
//   "1 3/4"        → 1.75
//   "1-3/4"        → 1.75   (hyphenated, common in scraped recipes)
//   "¾"            → 0.75
//   "1¾"           → 1.75
//   "1 ¾"          → 1.75
//   "3 / 4"        → 0.75   (loose spacing)
//   ""             → null
//   "abc"          → null
//   "1/0"          → null
//   "1//2"         → null
//   "1.2.3"        → null
```

### Formatter

```typescript
/**
 * Format a decimal quantity for display. Routes by unit class.
 */
function formatQuantity(value: number | null | undefined, unit?: string | null): string;

// Examples:
//   (1.75, "cup") → "1¾"
//   (0.333, "cup") → "⅓"        // within snap tolerance
//   (0.32, "cup")  → "⅓"        // also within tolerance
//   (0.27, "cup")  → "0.27"     // outside tolerance, decimal fallback
//   (1.5, "lb")    → "1.5"      // weight unit, decimal
//   (355, "g")     → "355"
//   (3.5, null)    → "3½"       // no unit defaults to fractional
//   (null, "cup")  → ""
```

### Unit Classifier

```typescript
type UnitClass = "fractional" | "decimal";

function unitClass(unit: string | null | undefined): UnitClass;
// "decimal":    g, kg, oz, lb, lbs, ml, l (case-insensitive, trimmed)
// "fractional": everything else (cup, tsp, tbsp, clove, can, pinch, dash, package, null/undefined/empty, unknown)
```

### Chip Row Component

```typescript
interface FractionChipRowProps {
  value: string;                       // current text in the qty input
  onChipTap: (next: string) => void;   // returns the new text with the chip inserted/replaced
  visible: boolean;                    // bound to input focus state
}
// Renders 8 chips: ½ ⅓ ¼ ⅔ ¾ ⅛ ⅜ ⅝
// Tapping a chip computes the new value:
//   - If `value` has no fractional part → append the unicode glyph
//   - If `value` has a fractional part (decimal or fraction) → strip and replace
//   - The integer part is always preserved
```

## Implementation Phases

| Phase | Name | Scope | Depends On | Key Outputs |
|-------|------|-------|------------|-------------|
| 1 | Fraction Support | Parser/formatter utility, editor input UX, display rendering across all surfaces | — | `quantity.ts` + tests, `FractionChipRow`, updated `IngredientEditor`, formatted RecipeDetail / SharedRecipe / GroceryList |

### Critical Path

Single phase, three internal steps that must run in dependency order:

1. **Step 1 (Utility):** `quantity.ts` + test suite. The spec.
2. **Step 2 (Editor):** `FractionChipRow` + `IngredientEditor` integration. Requires Step 1.
3. **Step 3 (Display):** Wire `formatQuantity` into RecipeDetail, SharedRecipe, GroceryList. Requires Step 1; can run in parallel with Step 2 if desired.

### Phase Details
- [Phase 1: Fraction Support](phases/phase-1.md)

## Tech Stack

| Category | Choice | Notes |
|----------|--------|-------|
| Frontend | React 19, TypeScript, Vite | Existing |
| Styling | Tailwind | Existing |
| Tests | Project's existing frontend test runner | Match the convention used elsewhere in `frontend/src/**/*.test.ts` |
| Backend | Rails 8 | Untouched in this phase; future Ruby port lives in the imported-recipe-parsing backlog item |

## Future Considerations

- **Ruby port of `parseQuantity`** — for the imported-recipe-parsing backlog item, when sage-rb / JSON-LD ingestion is ready to split scraped text like `"2 1/2 cups flour"` into `{quantity: 2.5, unit: "cup", name: "flour"}`. The TS test suite is the canonical spec; the Ruby port honors the same contract.
- **Format-preview hint** — show `→ ½` next to the quantity input as the user types, before blur
- **Live border tint** for in-progress validation — green/red as the parser succeeds/fails
- **Servings-scale animation** — when the user changes the servings count on RecipeDetail, animate quantities updating; with fraction snapping this would feel polished
- **Per-household measurement-system preference** — toggle between US fractional cups and metric grams for volumes; out of scope for v1, but unit-class routing leaves the door open
- **Quantity range support** — `"1-2 tablespoons"` is common in published recipes; needs a separate range type, deferred
