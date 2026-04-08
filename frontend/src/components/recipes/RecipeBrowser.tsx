import { useState, useDeferredValue, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { listRecipes } from "@/api/recipes";
import { RECIPE_CATEGORIES } from "@/types/recipe";
import type { RecipeFilters, RecipeType } from "@/types/recipe";
import { RecipeCard } from "./RecipeCard";

// Events aren't surfaced in the main library — they only exist as meal
// plan annotations. The meal plan picker has its own Event tab.
const TYPE_FILTERS: { value: RecipeType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "full", label: "Recipes" },
  { value: "quick_meal", label: "Quick Meals" },
];

export function RecipeBrowser() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState<RecipeType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const filters: RecipeFilters = {
    q: deferredSearch || undefined,
    recipe_type: typeFilter === "all" ? undefined : typeFilter,
    category: (categoryFilter || undefined) as RecipeFilters["category"],
  };

  // Filtered query — drives the displayed results
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recipes", filters],
    queryFn: () => listRecipes(filters),
  });

  // Unfiltered query — drives which filter chips are visible.
  // Cached separately so it only refetches when recipes are mutated.
  const { data: allData } = useQuery({
    queryKey: ["recipes", {}],
    queryFn: () => listRecipes({}),
  });

  const allRecipes = allData?.data ?? [];

  // Derive which filter values actually exist in the household
  const availableTypes = useMemo(() => {
    const types = new Set<RecipeType>();
    allRecipes.forEach((r) => types.add(r.recipe_type));
    return types;
  }, [allRecipes]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allRecipes.forEach((r) => {
      if (r.category) cats.add(r.category);
    });
    return cats;
  }, [allRecipes]);

  const visibleTypeFilters = TYPE_FILTERS.filter(
    (t) => t.value === "all" || availableTypes.has(t.value as RecipeType)
  );
  const visibleCategories = RECIPE_CATEGORIES.filter((c) =>
    availableCategories.has(c.value)
  );

  // Hide the type filter row entirely if there's only one type (just "All")
  const showTypeFilters = visibleTypeFilters.length > 2;
  const showCategoryFilters = visibleCategories.length > 0;

  const recipes = data?.data ?? [];
  const hasFilters = !!deferredSearch || typeFilter !== "all" || !!categoryFilter;

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("");
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type filter chips — only shown when there's more than one type */}
      {showTypeFilters && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {visibleTypeFilters.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeFilter(t.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t.value
                  ? "bg-garnish-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Category filter chips — only shown when categories exist */}
      {showCategoryFilters && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {visibleCategories.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === c.value ? "" : c.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === c.value
                  ? "bg-garnish-100 text-garnish-700 ring-1 ring-garnish-300"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Clear filters
        </button>
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
        <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
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
