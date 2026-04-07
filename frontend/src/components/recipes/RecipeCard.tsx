import { Link } from "react-router";
import { Clock, Users, Snowflake, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import type { RecipeSummary } from "@/types/recipe";

interface RecipeCardProps {
  recipe: RecipeSummary;
}

const TYPE_BADGE = {
  full: null,
  quick_meal: { icon: Snowflake, label: "Quick" },
  event: { icon: Calendar, label: "Event" },
} as const;

export function RecipeCard({ recipe }: RecipeCardProps) {
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
        className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
      >
        <div className="relative aspect-[4/3] bg-gradient-to-br from-garnish-50 to-garnish-100">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-garnish-300">
              {initial}
            </div>
          )}

          {badge && TypeIcon && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
              <TypeIcon className="h-3 w-3" />
              {badge.label}
            </div>
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
