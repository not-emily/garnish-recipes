import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw } from "lucide-react";
import type { RecipeCategory, Difficulty, RecipeSummary, SmartSections } from "@/types/recipe";
import { RECIPE_CATEGORIES, DIFFICULTIES } from "@/types/recipe";

export type SmartFilter =
  | "highly_rated"
  | "havent_made"
  | "never_tried"
  | "recently_used";

export type RecipeSortOption =
  | "updated_at"
  | "title"
  | "recently_cooked"
  | "prep_time"
  | "rating";

export interface RecipeFilterState {
  recipeType: "all" | "full" | "quick_meal";
  proteins: string[];
  categories: RecipeCategory[];
  cuisines: string[];
  difficulty: Difficulty | null;
  maxTime: number | null;
  smartFilter: SmartFilter | null;
  sort: RecipeSortOption;
}

export const DEFAULT_FILTERS: RecipeFilterState = {
  recipeType: "all",
  proteins: [],
  categories: [],
  cuisines: [],
  difficulty: null,
  maxTime: null,
  smartFilter: null,
  sort: "updated_at",
};

const SMART_FILTERS: { value: SmartFilter; label: string }[] = [
  { value: "highly_rated", label: "Highly Rated" },
  { value: "recently_used", label: "Recently Used" },
  { value: "havent_made", label: "Haven't Made in a While" },
  { value: "never_tried", label: "Never Tried" },
];

const TIME_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any" },
  { value: 30, label: "Under 30 min" },
  { value: 60, label: "Under 1 hour" },
  { value: 120, label: "Under 2 hours" },
];

const SORT_OPTIONS: { value: RecipeSortOption; label: string }[] = [
  { value: "updated_at", label: "Last Updated" },
  { value: "title", label: "Title" },
  { value: "recently_cooked", label: "Recently Cooked" },
  { value: "prep_time", label: "Prep Time" },
  { value: "rating", label: "Rating" },
];

const TYPE_OPTIONS: { value: "all" | "full" | "quick_meal"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "full", label: "Recipes" },
  { value: "quick_meal", label: "Quick Meals" },
];

export function countActiveFilters(filters: RecipeFilterState): number {
  let count = 0;
  if (filters.recipeType !== "all") count++;
  count += filters.proteins.length;
  count += filters.categories.length;
  count += filters.cuisines.length;
  if (filters.difficulty) count++;
  if (filters.maxTime) count++;
  if (filters.smartFilter) count++;
  if (filters.sort !== "updated_at") count++;
  return count;
}

interface RecipeFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: RecipeFilterState;
  onApply: (filters: RecipeFilterState) => void;
  allRecipes: RecipeSummary[];
  smartSections?: SmartSections | null;
  availableProteins: string[];
  availableCuisines: string[];
  availableCategories: RecipeCategory[];
  showTypeFilter: boolean;
}

export function RecipeFilterPanel({
  open,
  onClose,
  filters,
  onApply,
  allRecipes,
  smartSections,
  availableProteins,
  availableCuisines,
  availableCategories,
  showTypeFilter,
}: RecipeFilterPanelProps) {
  // Local draft so changes don't apply until the user taps "Show"
  const [draft, setDraft] = useState(filters);

  // Sync draft when panel opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  // Live preview count based on draft filters applied to all recipes
  const previewCount = useMemo(
    () => applyFiltersLocally(allRecipes, draft, smartSections ?? null).length,
    [allRecipes, draft, smartSections]
  );

  function handleReset() {
    setDraft(DEFAULT_FILTERS);
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Smart Filters */}
              <FilterSection title="Smart Filters">
                <PillGroup
                  options={SMART_FILTERS}
                  selected={draft.smartFilter ? [draft.smartFilter] : []}
                  onToggle={(v) =>
                    setDraft((d) => ({
                      ...d,
                      smartFilter: d.smartFilter === v ? null : (v as SmartFilter),
                    }))
                  }
                />
              </FilterSection>

              {/* Type */}
              {showTypeFilter && (
                <FilterSection title="Type">
                  <PillGroup
                    options={TYPE_OPTIONS}
                    selected={[draft.recipeType]}
                    onToggle={(v) =>
                      setDraft((d) => ({
                        ...d,
                        recipeType: v as "all" | "full" | "quick_meal",
                      }))
                    }
                  />
                </FilterSection>
              )}

              {/* Primary Protein */}
              {availableProteins.length > 0 && (
                <FilterSection title="Primary Protein">
                  <PillGroup
                    options={availableProteins.map((p) => ({
                      value: p,
                      label: p.charAt(0).toUpperCase() + p.slice(1),
                    }))}
                    selected={draft.proteins}
                    onToggle={(v) =>
                      setDraft((d) => ({
                        ...d,
                        proteins: d.proteins.includes(v)
                          ? d.proteins.filter((p) => p !== v)
                          : [...d.proteins, v],
                      }))
                    }
                  />
                </FilterSection>
              )}

              {/* Category */}
              {availableCategories.length > 0 && (
                <FilterSection title="Category">
                  <PillGroup
                    options={RECIPE_CATEGORIES.filter((c) =>
                      availableCategories.includes(c.value)
                    )}
                    selected={draft.categories}
                    onToggle={(v) =>
                      setDraft((d) => ({
                        ...d,
                        categories: d.categories.includes(v as RecipeCategory)
                          ? d.categories.filter((c) => c !== v)
                          : [...d.categories, v as RecipeCategory],
                      }))
                    }
                  />
                </FilterSection>
              )}

              {/* Cuisine */}
              {availableCuisines.length > 0 && (
                <FilterSection title="Cuisine">
                  <PillGroup
                    options={availableCuisines.map((c) => ({
                      value: c,
                      label: c.charAt(0).toUpperCase() + c.slice(1),
                    }))}
                    selected={draft.cuisines}
                    onToggle={(v) =>
                      setDraft((d) => ({
                        ...d,
                        cuisines: d.cuisines.includes(v)
                          ? d.cuisines.filter((c) => c !== v)
                          : [...d.cuisines, v],
                      }))
                    }
                  />
                </FilterSection>
              )}

              {/* Difficulty */}
              <FilterSection title="Difficulty">
                <PillGroup
                  options={DIFFICULTIES}
                  selected={draft.difficulty ? [draft.difficulty] : []}
                  onToggle={(v) =>
                    setDraft((d) => ({
                      ...d,
                      difficulty: d.difficulty === v ? null : (v as Difficulty),
                    }))
                  }
                />
              </FilterSection>

              {/* Time to Make */}
              <FilterSection title="Time to Make">
                <PillGroup
                  options={TIME_OPTIONS.map((t) => ({
                    value: String(t.value ?? "any"),
                    label: t.label,
                  }))}
                  selected={[String(draft.maxTime ?? "any")]}
                  onToggle={(v) =>
                    setDraft((d) => ({
                      ...d,
                      maxTime: v === "any" ? null : parseInt(v, 10),
                    }))
                  }
                />
              </FilterSection>

              {/* Sort By */}
              <FilterSection title="Sort By">
                <PillGroup
                  options={SORT_OPTIONS}
                  selected={[draft.sort]}
                  onToggle={(v) =>
                    setDraft((d) => ({ ...d, sort: v as RecipeSortOption }))
                  }
                />
              </FilterSection>
            </div>

            {/* Footer — apply button */}
            <div className="border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={handleApply}
                className="w-full rounded-lg bg-garnish-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-garnish-700"
              >
                {`Show ${previewCount} recipe${previewCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Shared sub-components ---

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function PillGroup({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected
                ? "bg-garnish-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Filter logic (shared for preview count) ---

function applyFiltersLocally(
  recipes: RecipeSummary[],
  filters: RecipeFilterState,
  smartSections: SmartSections | null
): RecipeSummary[] {
  let results = recipes;

  // Type
  if (filters.recipeType !== "all") {
    results = results.filter((r) => r.recipe_type === filters.recipeType);
  }
  // Proteins
  if (filters.proteins.length > 0) {
    results = results.filter(
      (r) => r.primary_protein && filters.proteins.includes(r.primary_protein)
    );
  }
  // Categories
  if (filters.categories.length > 0) {
    results = results.filter(
      (r) => r.category && filters.categories.includes(r.category)
    );
  }
  // Cuisines
  if (filters.cuisines.length > 0) {
    results = results.filter(
      (r) => r.cuisine && filters.cuisines.includes(r.cuisine)
    );
  }
  // Difficulty
  if (filters.difficulty) {
    results = results.filter((r) => r.difficulty === filters.difficulty);
  }
  // Max time
  if (filters.maxTime) {
    results = results.filter(
      (r) => r.total_time_minutes != null && r.total_time_minutes <= filters.maxTime!
    );
  }
  // Smart filter
  if (filters.smartFilter && smartSections) {
    let sectionRecipes: RecipeSummary[];
    switch (filters.smartFilter) {
      case "highly_rated":
        sectionRecipes = smartSections.favorites;
        break;
      case "recently_used":
        sectionRecipes = smartSections.recently_used;
        break;
      case "havent_made":
        sectionRecipes = smartSections.havent_made_in_a_while;
        break;
      case "never_tried":
        sectionRecipes = smartSections.never_tried;
        break;
      default:
        sectionRecipes = [];
    }
    const ids = new Set(sectionRecipes.map((r) => r.id));
    results = results.filter((r) => ids.has(r.id));
  }

  return results;
}
