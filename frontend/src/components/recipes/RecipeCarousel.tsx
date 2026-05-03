import type { LucideIcon } from "lucide-react";
import type { RecipeSummary } from "@/types/recipe";
import { RecipeCardCompact } from "./RecipeCardCompact";

interface RecipeCarouselProps {
  title: string;
  icon: LucideIcon;
  recipes: RecipeSummary[];
}

export function RecipeCarousel({ title, icon: Icon, recipes }: RecipeCarouselProps) {
  if (recipes.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-garnish-600" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
        {recipes.map((recipe) => (
          <RecipeCardCompact key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </section>
  );
}
