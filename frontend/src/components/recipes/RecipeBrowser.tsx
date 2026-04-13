import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, SlidersHorizontal } from "lucide-react";
import { listRecipes, getSmartSections } from "@/api/recipes";
import { RECIPE_CATEGORIES } from "@/types/recipe";
import type { RecipeFilters, RecipeCategory, RecipeType, RecipeSummary, SmartSections } from "@/types/recipe";
import { RecipeCard } from "./RecipeCard";
import {
  RecipeFilterPanel,
  countActiveFilters,
  DEFAULT_FILTERS,
  type RecipeFilterState,
  type SmartFilter,
} from "./RecipeFilterPanel";

export function RecipeBrowser() {
  const [filterState, setFilterState] = useState<RecipeFilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  // Build API filters from filter state. Multi-select protein/category/cuisine
  // are applied client-side when more than one is selected, since the backend
  // only supports single-value params.
  const apiFilters: RecipeFilters = useMemo(() => {
    const f: RecipeFilters = {
      recipe_type:
        filterState.recipeType === "all"
          ? undefined
          : filterState.recipeType,
      sort:
        filterState.sort === "updated_at" || filterState.sort === "rating"
          ? undefined
          : filterState.sort,
      difficulty: filterState.difficulty || undefined,
      max_time: filterState.maxTime || undefined,
    };
    // Single-value backend filters
    if (filterState.proteins.length === 1) f.protein = filterState.proteins[0];
    if (filterState.categories.length === 1) f.category = filterState.categories[0];
    if (filterState.cuisines.length === 1) f.cuisine = filterState.cuisines[0];
    return f;
  }, [filterState]);

  // Filtered query — drives the displayed results
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recipes", apiFilters],
    queryFn: () => listRecipes(apiFilters),
  });

  // Unfiltered query — drives which filter options are visible
  const { data: allData } = useQuery({
    queryKey: ["recipes", {}],
    queryFn: () => listRecipes({}),
  });

  // Smart sections for smart filter client-side filtering + panel preview count
  const { data: smartData } = useQuery({
    queryKey: ["smart-sections"],
    queryFn: getSmartSections,
  });

  const allRecipes = allData?.data ?? [];

  // Derive available filter values from the household's recipes
  const availableProteins = useMemo(
    () =>
      [...new Set(allRecipes.map((r) => r.primary_protein).filter(Boolean))]
        .sort() as string[],
    [allRecipes]
  );

  const availableCuisines = useMemo(
    () =>
      [...new Set(allRecipes.map((r) => r.cuisine).filter(Boolean))]
        .sort() as string[],
    [allRecipes]
  );

  const availableCategories = useMemo(() => {
    const cats = new Set<RecipeCategory>();
    allRecipes.forEach((r) => {
      if (r.category) cats.add(r.category);
    });
    return [...cats];
  }, [allRecipes]);

  const availableTypes = useMemo(() => {
    const types = new Set<RecipeType>();
    allRecipes.forEach((r) => types.add(r.recipe_type));
    return types;
  }, [allRecipes]);

  const showTypeFilter = availableTypes.size > 1;

  // Apply client-side filters (multi-select, smart filters, rating sort)
  const recipes = useMemo(() => {
    let results = data?.data ?? [];

    // Multi-select protein (when >1 selected, backend can't handle it)
    if (filterState.proteins.length > 1) {
      results = results.filter(
        (r) => r.primary_protein && filterState.proteins.includes(r.primary_protein)
      );
    }
    // Multi-select category
    if (filterState.categories.length > 1) {
      results = results.filter(
        (r) => r.category && filterState.categories.includes(r.category)
      );
    }
    // Multi-select cuisine
    if (filterState.cuisines.length > 1) {
      results = results.filter(
        (r) => r.cuisine && filterState.cuisines.includes(r.cuisine)
      );
    }

    // Smart filter — client-side filtering using smart sections data
    if (filterState.smartFilter && smartData?.data) {
      const sections = smartData.data;
      const smartIds = getSmartFilterIds(filterState.smartFilter, sections);
      if (smartIds) {
        results = results.filter((r) => smartIds.has(r.id));
      }
    }

    // Rating sort (not supported by backend)
    if (filterState.sort === "rating") {
      results = [...results].sort(
        (a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0)
      );
    }

    return results;
  }, [data?.data, filterState, smartData?.data]);

  const activeFilterCount = countActiveFilters(filterState);
  const hasFilters = activeFilterCount > 0;

  // Collect active filter chips for display
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (filterState.recipeType !== "all") {
      const label = filterState.recipeType === "full" ? "Recipes" : "Quick Meals";
      chips.push({
        key: "type",
        label,
        onRemove: () => setFilterState((s) => ({ ...s, recipeType: "all" })),
      });
    }
    for (const p of filterState.proteins) {
      chips.push({
        key: `protein-${p}`,
        label: p.charAt(0).toUpperCase() + p.slice(1),
        onRemove: () =>
          setFilterState((s) => ({
            ...s,
            proteins: s.proteins.filter((x) => x !== p),
          })),
      });
    }
    for (const c of filterState.categories) {
      const cat = CATEGORY_LABELS[c] ?? c;
      chips.push({
        key: `cat-${c}`,
        label: cat,
        onRemove: () =>
          setFilterState((s) => ({
            ...s,
            categories: s.categories.filter((x) => x !== c),
          })),
      });
    }
    for (const c of filterState.cuisines) {
      chips.push({
        key: `cuisine-${c}`,
        label: c.charAt(0).toUpperCase() + c.slice(1),
        onRemove: () =>
          setFilterState((s) => ({
            ...s,
            cuisines: s.cuisines.filter((x) => x !== c),
          })),
      });
    }
    if (filterState.difficulty) {
      chips.push({
        key: "difficulty",
        label: filterState.difficulty.charAt(0).toUpperCase() + filterState.difficulty.slice(1),
        onRemove: () => setFilterState((s) => ({ ...s, difficulty: null })),
      });
    }
    if (filterState.maxTime) {
      const label =
        filterState.maxTime <= 30
          ? "Under 30 min"
          : filterState.maxTime <= 60
            ? "Under 1 hour"
            : "Under 2 hours";
      chips.push({
        key: "time",
        label,
        onRemove: () => setFilterState((s) => ({ ...s, maxTime: null })),
      });
    }
    if (filterState.smartFilter) {
      const labels: Record<SmartFilter, string> = {
        highly_rated: "Highly Rated",
        recently_used: "Recently Used",
        havent_made: "Haven't Made",
        never_tried: "Never Tried",
      };
      chips.push({
        key: "smart",
        label: labels[filterState.smartFilter],
        onRemove: () => setFilterState((s) => ({ ...s, smartFilter: null })),
      });
    }
    if (filterState.sort !== "updated_at") {
      const labels: Record<string, string> = {
        title: "Sort: Title",
        recently_cooked: "Sort: Recently Cooked",
        prep_time: "Sort: Prep Time",
        rating: "Sort: Rating",
      };
      chips.push({
        key: "sort",
        label: labels[filterState.sort] ?? filterState.sort,
        onRemove: () => setFilterState((s) => ({ ...s, sort: "updated_at" })),
      });
    }
    return chips;
  }, [filterState]);

  function clearAll() {
    setFilterState(DEFAULT_FILTERS);
  }

  return (
    <div className="space-y-3">
      {/* Filter button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-garnish-600 text-[10px] font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter chips */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full bg-garnish-50 px-2.5 py-1 text-xs font-medium text-garnish-700 hover:bg-garnish-100"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Couldn't load recipes. Try again.
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={clearAll} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {/* Filter panel */}
      <RecipeFilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filterState}
        onApply={setFilterState}
        allRecipes={allRecipes}
        smartSections={smartData?.data ?? null}
        availableProteins={availableProteins}
        availableCuisines={availableCuisines}
        availableCategories={availableCategories}
        showTypeFilter={showTypeFilter}
      />
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
        <p className="text-sm text-gray-500">No recipes match your filters.</p>
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-sm font-medium text-garnish-600 hover:text-garnish-700"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
      <p className="text-sm text-gray-500">No recipes yet.</p>
      <p className="mt-1 text-xs text-gray-400">
        Tap the + button to add your first one.
      </p>
    </div>
  );
}

// --- Helpers ---

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  RECIPE_CATEGORIES.map((c) => [c.value, c.label])
);

function getSmartFilterIds(
  filter: SmartFilter,
  sections: SmartSections
): Set<string> | null {
  let recipes: RecipeSummary[];
  switch (filter) {
    case "highly_rated":
      recipes = sections.favorites;
      break;
    case "recently_used":
      recipes = sections.recently_used;
      break;
    case "havent_made":
      recipes = sections.havent_made_in_a_while;
      break;
    case "never_tried":
      recipes = sections.never_tried;
      break;
    default:
      return null;
  }
  return new Set(recipes.map((r) => r.id));
}
