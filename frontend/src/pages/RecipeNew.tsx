import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Snowflake, Calendar } from "lucide-react";
import { createRecipe } from "@/api/recipes";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import type { RecipeType, RecipeInput } from "@/types/recipe";

const TYPE_OPTIONS: {
  value: RecipeType;
  label: string;
  description: string;
  icon: typeof BookOpen;
}[] = [
  {
    value: "full",
    label: "Recipe",
    description: "Ingredients, instructions, and details",
    icon: BookOpen,
  },
  {
    value: "quick_meal",
    label: "Quick Meal",
    description: "Frozen, takeout, or pre-made",
    icon: Snowflake,
  },
  {
    value: "event",
    label: "Event",
    description: "Family dinner, date night, etc.",
    icon: Calendar,
  },
];

export function RecipeNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recipeType, setRecipeType] = useState<RecipeType | null>(null);

  const mutation = useMutation({
    mutationFn: (input: RecipeInput) => createRecipe(input),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      navigate(`/recipes/${res.data.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-8">
      <div className="mb-4">
        <Link
          to={recipeType ? "#" : "/recipes"}
          onClick={(e) => {
            if (recipeType) {
              e.preventDefault();
              setRecipeType(null);
            }
          }}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {recipeType ? "Back" : "Recipes"}
        </Link>
      </div>

      {!recipeType ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Something New</h1>
          <p className="mt-1 text-sm text-gray-500">What are you adding?</p>

          <div className="mt-6 space-y-3">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecipeType(opt.value)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-garnish-300 hover:bg-garnish-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-garnish-100 text-garnish-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{opt.label}</p>
                    <p className="text-sm text-gray-500">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            New {TYPE_OPTIONS.find((t) => t.value === recipeType)?.label}
          </h1>
          <div className="mt-6">
            <RecipeForm
              recipeType={recipeType}
              onSubmit={async (input) => {
                await mutation.mutateAsync(input);
              }}
              submitLabel="Create"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipeNew;
