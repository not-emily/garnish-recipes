# Project Progress - Garnish

## Plan Files
Roadmap: None
Current Phase: None
Latest Weekly Report: [weekly-2026-W17.md](../docs/reports/weekly-2026-W17.md)
Latest Daily Report: [daily-2026-04-24.md](../docs/reports/daily-2026-04-24.md)

Previously: [_archived/v4-fraction-support](../docs/plan/_archived/v4-fraction-support/) — Fraction support for ingredient quantities (1 phase, shipped 2026-04-29). Earlier: [v3-post-mvp-1](../docs/plan/_archived/v3-post-mvp-1/) — Stabilization, Polish & Sharing (2026-04-22 → 2026-04-24).

Last Updated: 2026-04-29


## Current Focus
**Phase 1: Fraction Support for Ingredient Quantities.** Single-phase plan addressing the `1¾ cup → 1.8 cup` rendering problem. Three internal steps: (1) `quantity.ts` parser + formatter utility with Vitest test suite, (2) `FractionChipRow` component + `IngredientEditor` rewrite, (3) wire `formatQuantity` into RecipeDetail / SharedRecipe / GroceryList display + grocery list input forms.

## Active Tasks
- [NEXT] Follow-up: broader mutation-button audit — migrate meal plan, import, and collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX (not blocking; current ones are functional)
- [NEXT] Follow-up: after deploying Phase 2, run `scripts/check-health.sh` against the server to baseline pool/memory/cable counts under normal load; revisit Puma/pool sizing if the numbers suggest different constraints than expected
- [NEXT] Follow-up: store auto-assign on manual-add — `GroceryListsController#add_item` doesn't consult `IngredientCategoryMapping`. ~5-line fix to lookup the mapping before save
- [NEXT] Follow-up: real-device verification of Phase 3D iOS input zoom fix on iPhone (Safari + PWA)

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. → **Addressed in Phase 3**.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field instead of structured `{ name, quantity, unit }`. Breaks grocery aggregation/dedup. → **Not in current plan's scope; tracked in backlog**.
- **Cook tracking counts at schedule time**: Phase 9A's `MealPlanEntry` `after_commit` increments `cook_count` on create rather than after the date passes. → **Resolved in Phase 4C (2026-04-24)**. The existing trigger already had a `date <= Date.current` guard; actual gap was future-dated entries whose date passes without create/destroy firing. `TallyCooksJob` sweeps nightly and recomputes from source.
- **Store auto-assign on manual-add**: `GroceryListsController#add_item` doesn't consult `IngredientCategoryMapping`, so re-adding an item manually (e.g., "eggs") doesn't pick up the previously-assigned store. Generation path does the lookup; manual path doesn't. → **~5-line fix; fold into Phase 4 or open as standalone**.
- **iOS input zoom verification**: `font-size: 16px !important` on inputs shipped in 3D but hasn't been tested on a real iPhone (Safari + PWA). Audit of utility-class overrides came back clean. → **Test before calling Phase 3 fully closed.**

## Completed This Week
- [2026-04-29] Phase 1 (Fraction Support) — parser/formatter utility, editor input UX, display rendering
  - `frontend/src/lib/quantity.ts`: `parseQuantity`, `formatQuantity`, `unitClass`, `replaceFractionalPart` — accepts integers, decimals, ascii fractions (`3/4`, `1 3/4`, `1-3/4`), unicode glyphs (`¾`, `1¾`); unit-class-driven display (cup/tsp/tbsp → fraction with halves/thirds/quarters/eighths snap; g/kg/oz/lb/ml/l → decimal)
  - `frontend/src/lib/quantity.test.ts`: 50-test Vitest suite covering parser, formatter, unit classifier, chip-helper, plus round-trip — serves as the canonical spec for the future Ruby port (imported-recipe-parsing backlog)
  - Vitest added as dev dep; `npm test` and `npm test:watch` scripts
  - `FractionChipRow` component: focus-triggered, `grid grid-cols-4 gap-1.5` layout (deterministic 4+4 wrap), `bg-white` pills with stronger border (was bleeding into prep field's `bg-gray-50`); `onMouseDown preventDefault` survives the input-blur race; visibility tied to `focused && unitClass(unit) === "fractional"`
  - `IngredientEditor` rewritten — extracted `IngredientRow` subcomponent; quantity input switched from `<input type="number">` to text with parser-driven blur. Auto-revert on truly unparseable input (data and UI always in sync; no validity-bubbling plumbing required)
  - `GroceryList`: `EditItemModal` and `AddItemForm` quantity inputs got the same treatment (text + chip row + parse-on-save). Chip row lifted out of the narrow grid columns to span full modal/form width. `formatItemLabel` routes through `formatQuantity` so aggregated quantities display correctly
  - `RecipeDetail` and `SharedRecipe` ingredient quantities route through `formatQuantity`
  - **Deviation from initial plan:** plan said chip row visibility was tied just to focus; refined to `focused && unitClass(unit) === "fractional"` so chips don't appear (and tempt) when unit is `g`/`lb`/etc. Cleaner UI signal.
  - **Deviation from initial plan:** invalid-qty UX in `IngredientEditor` shipped as auto-revert rather than validity-bubbling to `RecipeForm` — ~5 lines vs ~30 of cross-component plumbing, and avoids the index-key reorder bug. Bounce-back is the feedback.
  - **Verification:** build clean (`npm run build`), 50/50 tests passing, ESLint clean on all touched files. Browser smoke check + iPhone tap behavior pending the user.

## Backlog (Out of Current Plan)
Preserved from prior "Next Session" list; revisit after the current 4-phase plan ships:

- Recipe images (add/edit)
- Cooking mode — toggle between recipes in a meal slot while cooking
- Quick filter pills on recipe browse (outside the full filter panel)
- Fraction support for ingredient quantities (⅔, 1½, etc.)
- "What's on the menu" banner showing today's meal plan on the recipe browse page
- Visual re-theme as part of the navigation rework
- Tutorial/coachmark system for first-time users and new features
- Password strength validation
- Google OAuth sign-in option
- Settings page UI cleanup
- Instruction sections/groups on recipes (mirror ingredient_groups pattern)
- Re-trigger leftover prompt on `servings_override` change in EntryOptions
- Imported recipe ingredient parsing (structured quantity/unit/name split)
- Image ingestion via vision (needs upstream sage-rb multi-modal support)
- Recipe detail source-attachment download UI
- PDF export option for recipes/collections
- Deeper accessibility audit (contrast, focus-visible, aria-live)
- Image optimization (WebP, srcset) for user-uploaded recipe images
