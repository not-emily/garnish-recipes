import { Link } from "react-router";
import { Clock, Snowflake, Calendar, StickyNote, MoreVertical, Utensils } from "lucide-react";
import type { MealPlanEntry } from "@/types/mealPlan";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface MealEntryProps {
  entry: MealPlanEntry;
  onOptionsClick?: (entry: MealPlanEntry) => void;
}

// Visual affordance by entry kind — a small icon + accent color so users
// can tell at a glance whether a slot is a planned recipe, a leftovers
// reminder, a one-off note, etc.
const KIND_STYLE: Record<
  MealPlanEntry["kind"],
  { icon: typeof Clock; ring: string; bg: string; text: string }
> = {
  full: {
    icon: Clock,
    ring: "ring-garnish-200",
    bg: "bg-white",
    text: "text-gray-900",
  },
  quick_meal: {
    icon: Snowflake,
    ring: "ring-sky-200",
    bg: "bg-sky-50",
    text: "text-sky-900",
  },
  event: {
    icon: Calendar,
    ring: "ring-purple-200",
    bg: "bg-purple-50",
    text: "text-purple-900",
  },
  note: {
    icon: StickyNote,
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
  },
};

// Leftovers get their own muted style regardless of the underlying kind —
// they're pre-cooked food, not a planned recipe to shop for, and should
// read as a lightweight annotation on the week rather than a new meal.
const LEFTOVER_STYLE = {
  icon: Utensils,
  ring: "ring-gray-200",
  bg: "bg-gray-50",
  text: "text-gray-600",
} as const;

export function MealEntry({ entry, onOptionsClick }: MealEntryProps) {
  const style = entry.is_leftover ? LEFTOVER_STYLE : KIND_STYLE[entry.kind];
  const Icon = style.icon;

  // Wide + hover-capable = desktop. Anywhere else (phones, tablets,
  // narrow laptop windows) we keep the meatball menu always visible
  // because there's no reliable hover affordance. We do this in JS
  // rather than Tailwind arbitrary variants because Tailwind v4's
  // parser doesn't reliably accept combined `(min-width: X) and
  // (hover: hover)` media queries.
  const isDesktopHover = useMediaQuery("(min-width: 1024px) and (hover: hover)");

  // Recipe-backed entries link to the recipe detail page. Notes don't link
  // anywhere; tapping the options button is the only action.
  const body = (
    <div
      className={`group flex items-start gap-2 rounded-lg ${style.bg} p-2 pr-1 ring-1 ${style.ring} transition-shadow hover:shadow-sm`}
    >
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.text}`} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-medium ${style.text} ${entry.is_leftover ? "italic" : ""}`}>
          {entry.title}
          {entry.is_leftover && <span className="ml-1 font-normal opacity-75">(leftovers)</span>}
        </p>
        {entry.recipe?.total_time_minutes && (
          <p className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {entry.recipe.total_time_minutes}m
            </span>
          </p>
        )}
        {entry.kind === "event" && entry.recipe?.has_notes && (
          <p className="mt-0.5 flex items-center text-[10px] text-purple-400">
            <StickyNote className="h-2.5 w-2.5" />
          </p>
        )}
      </div>
      {onOptionsClick && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOptionsClick(entry);
          }}
          // On desktop we hide the button at rest so the title can use
          // the full card width; it reveals on group hover (or keyboard
          // focus) and the title truncates shorter. On touch devices,
          // narrow viewports, and iPad-style tablets it stays visible.
          className={`shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 ${
            isDesktopHover
              ? "hidden group-hover:inline-flex focus-visible:inline-flex"
              : "inline-flex"
          }`}
          aria-label="Entry options"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  if (entry.recipe) {
    // Pass a referrer hint so RecipeDetail's back link goes to Meal Plan
    // instead of the default Recipes library. Lost on refresh, which
    // falls back gracefully to /recipes.
    return (
      <Link
        to={`/recipes/${entry.recipe.id}`}
        state={{ from: "mealPlan" }}
        className="block"
      >
        {body}
      </Link>
    );
  }
  return body;
}
