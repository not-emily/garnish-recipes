import { Link } from "react-router";
import { Clock, Users, Snowflake, Calendar, Star, CalendarPlus } from "lucide-react";
import { motion } from "framer-motion";
import type { RecipeSummary } from "@/types/recipe";

interface RecipeCardProps {
  recipe: RecipeSummary;
  linkState?: Record<string, unknown>;
  onAddToPlan?: (recipe: RecipeSummary) => void;
}

const TYPE_BADGE = {
  full: null,
  quick_meal: { icon: Snowflake, label: "Quick" },
  event: { icon: Calendar, label: "Event" },
} as const;

export function RecipeCard({ recipe, linkState, onAddToPlan }: RecipeCardProps) {
  const badge = TYPE_BADGE[recipe.recipe_type];
  const TypeIcon = badge?.icon;
  // Defensive: a recipe should always have a title, but in-flight imports
  // and bad data shouldn't crash the whole list.
  const title = recipe.title ?? "Untitled recipe";
  const initial = title.charAt(0).toUpperCase() || "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Link
        to={`/recipes/${recipe.id}`}
        state={linkState}
        className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
      >
        <div className="relative h-0 overflow-hidden bg-gradient-to-br from-garnish-50 to-garnish-100" style={{ paddingBottom: '75%' }}>
          {(recipe.image_thumb_url ?? recipe.image_url) ? (
            <img
              src={recipe.image_thumb_url ?? recipe.image_url ?? ""}
              alt={title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl text-garnish-300">
              {initial}
            </div>
          )}

          {badge && TypeIcon && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
              <TypeIcon className="h-3 w-3" />
              {badge.label}
            </div>
          )}

          {onAddToPlan && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToPlan(recipe);
              }}
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-garnish-600"
              aria-label="Add to meal plan"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 font-medium text-gray-900 group-hover:text-garnish-700">
            {title}
          </h3>

          {(recipe.cuisine || recipe.tags.length > 0) && (
            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
              {recipe.cuisine && <span>{recipe.cuisine}</span>}
              {recipe.cuisine && recipe.tags.length > 0 && <span> · </span>}
              {recipe.tags.slice(0, 3).join(" · ")}
            </p>
          )}

          <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-gray-400">
            {recipe.rating_count > 0 && recipe.average_rating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {recipe.average_rating.toFixed(1)}
              </span>
            )}
            {recipe.total_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {recipe.total_time_minutes}m
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {recipe.servings}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
