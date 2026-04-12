import type { RecipeType } from "./recipe";

export type MealSlot = "breakfast" | "lunch" | "dinner";

// "kind" is derived server-side from recipe.recipe_type (or "note" if the
// entry has no recipe). Matches RecipeType plus the extra "note" case.
export type EntryKind = RecipeType | "note";

export interface MealPlanEntry {
  id: number;
  date: string; // ISO date
  meal_slot: MealSlot;
  kind: EntryKind;
  title: string;
  position: number;
  servings_override: number | null;
  diners_override: number | null;
  include_in_grocery: boolean;
  // True when the entry contributes ingredients to the grocery list — i.e.,
  // it's backed by a full recipe or quick meal. Events, notes, and leftover
  // entries are false. Derived server-side so the frontend doesn't duplicate
  // the logic.
  grocery_relevant: boolean;
  is_leftover: boolean;
  // Internal id of the source entry this leftover came from. Used to visually
  // link a leftover back to the original meal in the UI.
  leftover_of_id: number | null;
  leftover_servings: number | null;
  recipe?: {
    id: string; // public apikey
    title: string;
    recipe_type: RecipeType;
    image_url: string | null;
    servings: number | null;
    total_time_minutes: number | null;
    has_notes: boolean;
  };
}

export interface MealPlan {
  week_start: string; // ISO date (Monday)
  week_end: string; // ISO date (Sunday)
  entries: MealPlanEntry[];
}

export interface CreateEntryInput {
  recipe_id?: string; // public apikey; omit for notes
  date: string;
  meal_slot: MealSlot;
  title?: string; // notes only
  // Optional linked leftover entries — each produces a second MealPlanEntry
  // with is_leftover: true pointing at the one being created here. Only
  // valid with a recipe-backed entry.
  leftovers?: { date: string; meal_slot: MealSlot }[];
  // When true, the backend creates LeftoverTrayItem rows for any cooked
  // surplus (full meals the user didn't schedule + partial remainder).
  // Frontend sets this based on the LeftoverPrompt toggle and household
  // settings.
  track_remaining?: boolean;
}

export interface CreateEntryResponse {
  data: MealPlanEntry;
  leftovers?: MealPlanEntry[];
  // Tray items created for surplus when track_remaining is true. Consumed
  // by useMealPlan to invalidate the tray cache after the mutation.
  tray_items?: unknown[];
}

export interface UpdateEntryInput {
  date?: string;
  meal_slot?: MealSlot;
  title?: string;
  servings_override?: number | null;
  diners_override?: number | null;
  include_in_grocery?: boolean;
  position?: number;
}

export const MEAL_SLOTS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];
