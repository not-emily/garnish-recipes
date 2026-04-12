import { useQuery } from "@tanstack/react-query";
import { Clock, Heart, CalendarClock, Sparkles, Zap } from "lucide-react";
import { getSmartSections } from "@/api/recipes";
import { RecipeCarousel } from "./RecipeCarousel";

export function SmartBrowse() {
  const { data, isLoading } = useQuery({
    queryKey: ["smart-sections"],
    queryFn: getSmartSections,
  });

  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        {[1, 2].map((i) => (
          <div key={i}>
            <div className="mb-2 h-4 w-32 animate-pulse rounded bg-gray-100" />
            <div className="flex gap-3">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-52 w-40 shrink-0 animate-pulse rounded-xl bg-gray-100"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const sections = data?.data;
  if (!sections) return null;

  const hasAny =
    sections.recently_used.length > 0 ||
    sections.favorites.length > 0 ||
    sections.havent_made_in_a_while.length > 0 ||
    sections.never_tried.length > 0 ||
    sections.quick_meals.length > 0;

  if (!hasAny) return null;

  return (
    <div className="mb-4">
      <RecipeCarousel
        title="Recently Used"
        icon={Clock}
        recipes={sections.recently_used}
      />
      <RecipeCarousel
        title="Favorites"
        icon={Heart}
        recipes={sections.favorites}
      />
      <RecipeCarousel
        title="Haven't Made in a While"
        icon={CalendarClock}
        recipes={sections.havent_made_in_a_while}
      />
      <RecipeCarousel
        title="Never Tried"
        icon={Sparkles}
        recipes={sections.never_tried}
      />
      <RecipeCarousel
        title="Quick Meals"
        icon={Zap}
        recipes={sections.quick_meals}
      />
    </div>
  );
}
