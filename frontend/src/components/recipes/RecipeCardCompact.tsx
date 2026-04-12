import { Link } from "react-router";
import { Clock, Star } from "lucide-react";
import type { RecipeSummary } from "@/types/recipe";

interface RecipeCardCompactProps {
  recipe: RecipeSummary;
}

export function RecipeCardCompact({ recipe }: RecipeCardCompactProps) {
  const title = recipe.title ?? "Untitled";
  const initial = title.charAt(0).toUpperCase() || "?";

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-gradient-to-br from-garnish-50 to-garnish-100">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-garnish-300">
            {initial}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2">
        <h3 className="truncate text-sm font-medium text-gray-900">
          {title}
        </h3>
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-gray-400">
          {recipe.rating_count > 0 && recipe.average_rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {recipe.average_rating.toFixed(1)}
            </span>
          )}
          {recipe.total_time_minutes && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {recipe.total_time_minutes}m
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
