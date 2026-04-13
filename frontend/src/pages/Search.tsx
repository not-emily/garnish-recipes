import { useDeferredValue } from "react";
import { useSearchParams, Link } from "react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listRecipes } from "@/api/recipes";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { SmartBrowse } from "@/components/recipes/SmartBrowse";
import { PageHeader } from "@/components/layout/PageHeader";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const deferredQuery = useDeferredValue(query);

  const { data, isLoading } = useQuery({
    queryKey: ["recipes", { q: deferredQuery }],
    queryFn: () => listRecipes({ q: deferredQuery }),
    enabled: !!deferredQuery,
    placeholderData: keepPreviousData,
  });

  const recipes = data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
      <PageHeader title="Search" />

      {!deferredQuery ? (
        <SmartBrowse />
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            No recipes match &ldquo;{deferredQuery}&rdquo;
          </p>
          <Link
            to="/recipes"
            className="mt-2 inline-block text-sm font-medium text-garnish-600 hover:text-garnish-700"
          >
            Browse all recipes &rarr;
          </Link>
        </div>
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

export default SearchPage;
