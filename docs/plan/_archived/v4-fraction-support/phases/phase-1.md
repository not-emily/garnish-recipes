# Phase 1: Fraction Support

> **Depends on:** None
> **Enables:** Imported-recipe-parsing backlog item (via Ruby port of `parseQuantity` honoring the same test spec)
>
> See: [Full Plan](../plan.md)

## Goal

Replace decimal-only ingredient quantity rendering with unit-aware fractional rendering, end to end — from parsing user input to displaying aggregated grocery list quantities.

## Key Deliverables

- `parseQuantity(text) → number | null` and `formatQuantity(value, unit) → string` utilities, plus a unit classifier, all in `frontend/src/lib/quantity.ts`
- Comprehensive test suite covering all parser branches, formatter snap behavior, and unit classification — serves as the canonical spec
- `FractionChipRow` component — focus-triggered chip row with 8 unicode fraction chips
- `IngredientEditor.tsx` updated: text input, parser-driven validation, chip-row integration, error state on invalid input
- Quantity rendering on `RecipeDetail.tsx`, `SharedRecipe.tsx`, and `GroceryList.tsx` routed through `formatQuantity`

## Files to Create

- `frontend/src/lib/quantity.ts` — parser, formatter, unit classifier
- `frontend/src/lib/quantity.test.ts` — full test suite (the spec)
- `frontend/src/components/recipes/FractionChipRow.tsx` — focus-triggered chip row

## Files to Modify

- `frontend/package.json` + `frontend/vite.config.ts` — add Vitest as a dev dependency, add `test` script, configure test environment
- `frontend/src/components/recipes/IngredientEditor.tsx` — quantity input rewrite (text + validation + chip row)
- `frontend/src/pages/RecipeDetail.tsx` — route ingredient quantities through `formatQuantity` (lines 486-490)
- `frontend/src/pages/SharedRecipe.tsx` — `formatIngredient` helper through `formatQuantity` (line 252)
- `frontend/src/pages/GroceryList.tsx` — three sites:
  - `formatItemLabel` display helper (line 757-765) — replace manual integer/decimal logic with `formatQuantity`
  - `EditItemModal` qty input (line 487-489) — text input with validation + chip row, `parseQuantity` on save
  - `AddItemForm` qty input (line 606, 677-684) — same treatment

## Dependencies

**Internal:** None — first and only phase of this plan.

**External:** Vitest (dev-only) — adds frontend test infrastructure. The plan originally assumed a frontend test runner existed; it does not. Vitest is the natural fit (built on Vite, zero-config for the project's setup). Used only for `quantity.test.ts` in this phase; available for future tests as the project warrants.

## Implementation Notes

### Step 1 — Utility (`quantity.ts`)

Build the parser as a single function that walks from most specific shape to most general. The order matters because earlier branches would otherwise greedily match strings that the later branches handle correctly:

1. Trim; return `null` if empty
2. Try unicode-fraction-only (`¾`)
3. Try integer-then-unicode-fraction (`1¾` or `1 ¾`)
4. Try mixed ascii fraction (`1 3/4` or `1-3/4`)
5. Try ascii fraction alone (`3/4`, allowing `3 / 4`)
6. Try integer or decimal (`1`, `1.5`, `.5`)
7. Anything else → `null`

Reject divide-by-zero (`1/0`, `0/0`). Reject pathological forms (`1//2`, `//`, `1/`, `1.2.3`).

Unicode-fraction map (accept on input even if not all eight appear on the chip row):

```typescript
const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "¼": 0.25,  "¾": 0.75,
  "⅕": 0.2,   "⅖": 0.4,   "⅗": 0.6,   "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};
```

Formatter snapping:

```typescript
const FRACTIONAL_DENOMINATORS = [2, 3, 4, 8];  // halves, thirds, quarters, eighths
const SNAP_TOLERANCE = 0.02;

// Try each denominator; for each, find numerator = round(remainder * denom).
// If |remainder - numerator/denom| <= SNAP_TOLERANCE, that's a valid snap.
// Pick the snap with the smallest denominator that fits (cleanest fraction).
// If no denominator fits, fall back to decimal rendering.
```

Decimal rendering: `Number.toFixed(2)` then strip trailing zeros and a trailing dot. Examples: `1.5 → "1.5"`, `1.0 → "1"`, `0.27 → "0.27"`.

Glyph map for output (smallest-denominator snaps only):

```typescript
const SNAP_GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓", "2/3": "⅔",
  "1/4": "¼", "3/4": "¾",
  "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};
```

Unit classifier (decimal-class set is the small one; everything else defaults to fractional):

```typescript
const DECIMAL_UNITS = new Set(["g", "kg", "oz", "lb", "lbs", "ml", "l"]);

function unitClass(unit: string | null | undefined): UnitClass {
  if (!unit) return "fractional";
  return DECIMAL_UNITS.has(unit.trim().toLowerCase()) ? "decimal" : "fractional";
}
```

Test cases (the spec — at minimum):

- **Parser:**
  - All examples in the Core Interfaces parser block
  - Whitespace tolerance: `"  3 / 4  "` → 0.75, `" 1 "` → 1
  - Boundary: `"0"` → 0, `"0.5"` → 0.5, `".5"` → 0.5
  - Invalid: empty, whitespace-only, letters, `1/0`, `0/0`, `1//2`, `1.2.3`, `½½`, `¾ ¾`, `1/`, `/2`
- **Formatter:**
  - Each fractional unit produces a snapped fraction for known values (cup, tsp, tbsp, clove, can, no-unit)
  - Each decimal unit produces a decimal (g, kg, oz, lb, lbs, ml, l)
  - Snap tolerance edges: just inside (`0.32` → `⅓`), just outside (`0.27` → `0.27`)
  - Whole numbers render without trailing fraction (`1.0` → `"1"`)
  - Smallest-denominator preferred (`0.5` → `"½"`, not `"4/8"`)
  - Mixed numbers (`1.75` → `"1¾"`, `2.625` → `"2⅝"`)
  - `null` / `undefined` / `0` produce sensible empty/zero output
- **Unit classifier:**
  - Each known fractional unit, each known decimal unit
  - Case insensitivity (`"CUP"`, `"Cup"`, `"cup"` all classify the same)
  - Unknown unit (`"bunch"`, `"head"`) → `"fractional"`

### Step 2 — Editor (`FractionChipRow.tsx` + `IngredientEditor.tsx`)

`FractionChipRow` is small and presentational. The caller decides visibility — typically `focused && unitClass(unit) === "fractional"`:

```tsx
const CHIPS = ["½", "⅓", "¼", "⅔", "¾", "⅛", "⅜", "⅝"];

interface FractionChipRowProps {
  value: string;
  onChipTap: (next: string) => void;
  visible: boolean;
}

export function FractionChipRow({ value, onChipTap, visible }: FractionChipRowProps) {
  if (!visible) return null;
  return (
    <div className="mt-1 flex gap-1">
      {CHIPS.map((chip) => (
        <button
          type="button"
          key={chip}
          onMouseDown={(e) => e.preventDefault()}  // CRITICAL: prevents input blur before click fires
          onClick={() => onChipTap(replaceFractionalPart(value, chip))}
          className="rounded-md bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
```

`onMouseDown` with `preventDefault` is critical — without it, mousedown blurs the input, the chip row hides via the `visible` prop, and the click event never fires. This is a known quirk of focus-gated UI patterns. Touch events on iOS go through the same code path so the same fix applies there.

`replaceFractionalPart` strips any existing fractional part (decimal portion or unicode glyph or `n/m` suffix) and appends the new chip, preserving the integer part:

- `""` + `¾` → `"¾"`
- `"1"` + `¾` → `"1¾"`
- `"1¾"` + `½` → `"1½"`
- `"1.5"` + `⅓` → `"1⅓"`
- `"1 3/4"` + `½` → `"1½"`

In `IngredientEditor`, replace the existing quantity `<input type="number">` with a controlled text input. Local string state (`qtyText`) lives alongside the numeric `quantity` field — only commit a parsed number to the parent on blur. This keeps the user's in-progress text intact across re-renders.

```tsx
const [qtyText, setQtyText] = useState(
  ing.quantity != null ? formatQuantity(ing.quantity, ing.unit) : ""
);
const [qtyFocused, setQtyFocused] = useState(false);
const [qtyError, setQtyError] = useState(false);

// ...

<input
  type="text"
  inputMode="text"
  value={qtyText}
  onChange={(e) => {
    setQtyText(e.target.value);
    setQtyError(false);  // clear error as user types
  }}
  onFocus={() => setQtyFocused(true)}
  onBlur={() => {
    setQtyFocused(false);
    const trimmed = qtyText.trim();
    if (trimmed === "") {
      setQtyError(false);
      updateIngredient(gi, ii, { quantity: null });
      return;
    }
    const parsed = parseQuantity(trimmed);
    if (parsed === null) {
      setQtyError(true);
    } else {
      setQtyError(false);
      updateIngredient(gi, ii, { quantity: parsed });
    }
  }}
  placeholder="Qty"
  className={cn(
    "col-span-2 rounded-md border px-1.5 py-1 text-sm focus:outline-none focus:ring-1",
    qtyError
      ? "border-red-400 focus:border-red-500 focus:ring-red-500"
      : "border-gray-200 focus:border-garnish-500 focus:ring-garnish-500"
  )}
/>
<FractionChipRow
  value={qtyText}
  onChipTap={(next) => {
    setQtyText(next);
    setQtyError(false);
  }}
  visible={qtyFocused && unitClass(ing.unit) === "fractional"}
/>
```

The chip row sits between the qty/unit/name row and the preparation row (or wherever fits cleanly given the existing 12-column grid). Re-flow only while focused — the resting layout is unchanged.

If the form's save button isn't already disabled when any row has an error, surface the error state up to the parent (or expose an `onValidityChange` callback from `IngredientEditor`) so save can be blocked. The existing form likely already validates required fields; piggyback on that.

### Step 3 — Display + Grocery Inputs (RecipeDetail / SharedRecipe / GroceryList)

Three render sites, identified by grep for `*.quantity` in `pages/`:

- `RecipeDetail.tsx:486-490` — direct render `{ing.quantity}` → `{formatQuantity(ing.quantity, ing.unit)}`
- `SharedRecipe.tsx:252` — `parts.push(String(ing.quantity))` → `parts.push(formatQuantity(ing.quantity, ing.unit))`
- `GroceryList.tsx:757-765` — `formatItemLabel` has a manual integer/decimal switch (`Number.isInteger ? quantity : quantity.toFixed(1)`); replace the whole branch with `formatQuantity(item.quantity, item.unit)`

Plus the grocery input forms (covered in Step 2's logic but living in `GroceryList.tsx`):

- `EditItemModal:487-489` — qty input is already `<input type="text" inputMode="decimal">`. Switch `inputMode` to `"text"`, add validation state, integrate `FractionChipRow`, replace `Number(quantity)` (line 570) with `parseQuantity(quantity)` on save
- `AddItemForm:606,677-684` — same treatment, replace `Number(quantity)` (line 620) with `parseQuantity(quantity)` on submit

There is no client-side servings scaling on RecipeDetail today, so post-scale snapping isn't applicable to v1.

## Validation

- [ ] All `parseQuantity` test cases pass (integer, decimal, ascii fraction, mixed, hyphenated, unicode, loose spacing, whitespace, empty, invalid forms)
- [ ] All `formatQuantity` test cases pass (fractional unit snap, decimal unit pass-through, snap tolerance edges, integer-only, null/undefined input, smallest-denominator preference)
- [ ] Unit classifier returns the correct class for every entry in `COMMON_UNITS` plus a couple of unknowns (`bunch`, `head`)
- [ ] Editor: typing `1 3/4` and blurring stores `1.75` on the parent ingredient
- [ ] Editor: typing `abc` shows the error border, blocks save
- [ ] Editor: tapping `¾` in the chip row with `1` in the field produces `1¾`
- [ ] Editor: tapping `½` in the chip row with `1¾` in the field produces `1½`
- [ ] Editor: tapping a chip does not blur the input — chip row stays visible after tap
- [ ] Editor: chip row appears when the quantity field is focused AND unit is fractional-class (or empty); hides on blur or when unit is decimal-class
- [ ] Editor: typing `g` in the unit field while qty is focused causes the chip row to disappear
- [ ] RecipeDetail: ingredient stored as `1.75` with unit `cup` displays as `1¾ cup`
- [ ] RecipeDetail: ingredient stored as `1.5` with unit `lb` displays as `1.5 lb`
- [ ] SharedRecipe: same display rules apply (smoke-check one of each unit class)
- [ ] GroceryList display: an aggregated `0.666 cup` quantity displays as `⅔ cup`
- [ ] GroceryList display: an aggregated `355 g` quantity displays as `355 g`
- [ ] GroceryList EditItemModal: same input rules as IngredientEditor (text, validation, unit-aware chips)
- [ ] GroceryList AddItemForm: same input rules; `parseQuantity` used on submit instead of `Number()`
- [ ] No backend changes required; backend tests still pass
- [ ] `npm run build` succeeds (matches Cloudflare Pages' build via `tsc -b`, not the looser `tsc --noEmit`)
- [ ] Visual smoke-test on a real iPhone: chip row tap-to-insert works, no surprise keyboard behavior, font-size 16px rule still applies
