import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_FILTERS,
  type RecipeFilterState,
  type SmartFilter,
  type RecipeSortOption,
} from "@/components/recipes/RecipeFilterPanel";
import type { RecipeCategory, Difficulty } from "@/types/recipe";

/**
 * Sticky recipe filter state. Persisted to localStorage so filters survive
 * refresh, navigation, and tab close; cleared only by explicit user action
 * ("Clear all" in the filter panel). No URL sync — in a PWA, back-nav is
 * in-app React Router and doesn't round-trip through the address bar, so
 * URL-backed state would be lost whenever a back handler navigates fresh
 * rather than popping history.
 */

const STORAGE_KEY = "garnish:recipeFilters:v1";

const SMART_VALUES = new Set<SmartFilter>([
  "highly_rated",
  "recently_used",
  "havent_made",
  "never_tried",
]);

const SORT_VALUES = new Set<RecipeSortOption>([
  "updated_at",
  "title",
  "recently_cooked",
  "prep_time",
  "rating",
  "my_rating",
]);

const TYPE_VALUES = new Set<RecipeFilterState["recipeType"]>([
  "all",
  "full",
  "quick_meal",
]);

const DIFFICULTY_VALUES = new Set<Difficulty>(["easy", "medium", "hard"]);

function sanitize(raw: unknown): RecipeFilterState {
  if (!raw || typeof raw !== "object") return DEFAULT_FILTERS;
  const r = raw as Record<string, unknown>;

  const recipeType =
    typeof r.recipeType === "string" && TYPE_VALUES.has(r.recipeType as RecipeFilterState["recipeType"])
      ? (r.recipeType as RecipeFilterState["recipeType"])
      : DEFAULT_FILTERS.recipeType;

  const sort =
    typeof r.sort === "string" && SORT_VALUES.has(r.sort as RecipeSortOption)
      ? (r.sort as RecipeSortOption)
      : DEFAULT_FILTERS.sort;

  const difficulty =
    typeof r.difficulty === "string" && DIFFICULTY_VALUES.has(r.difficulty as Difficulty)
      ? (r.difficulty as Difficulty)
      : null;

  const smartFilter =
    typeof r.smartFilter === "string" && SMART_VALUES.has(r.smartFilter as SmartFilter)
      ? (r.smartFilter as SmartFilter)
      : null;

  const maxTime =
    typeof r.maxTime === "number" && Number.isFinite(r.maxTime) ? r.maxTime : null;

  const stringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    recipeType,
    proteins: stringArray(r.proteins),
    categories: stringArray(r.categories) as RecipeCategory[],
    cuisines: stringArray(r.cuisines),
    difficulty,
    maxTime,
    smartFilter,
    sort,
  };
}

function readFromStorage(): RecipeFilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_FILTERS;
  }
}

function writeToStorage(state: RecipeFilterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — filter state just isn't persisted
    // this session. Not worth surfacing to the user.
  }
}

export function useRecipeFilters(): [
  RecipeFilterState,
  (next: RecipeFilterState | ((prev: RecipeFilterState) => RecipeFilterState)) => void,
] {
  const [state, setState] = useState<RecipeFilterState>(readFromStorage);

  const update = useCallback(
    (next: RecipeFilterState | ((prev: RecipeFilterState) => RecipeFilterState)) => {
      setState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeToStorage(resolved);
        return resolved;
      });
    },
    []
  );

  // Cross-tab sync: if filters change in another tab/window (rare in a PWA
  // but possible when running in a browser), reflect the update here too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) {
        setState(DEFAULT_FILTERS);
        return;
      }
      try {
        setState(sanitize(JSON.parse(e.newValue)));
      } catch {
        setState(DEFAULT_FILTERS);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [state, update];
}
