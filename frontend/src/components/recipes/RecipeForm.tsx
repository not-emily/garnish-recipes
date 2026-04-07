import { useState, type FormEvent } from "react";
import { IngredientEditor } from "./IngredientEditor";
import { InstructionEditor } from "./InstructionEditor";
import { RECIPE_CATEGORIES, DIFFICULTIES } from "@/types/recipe";
import type {
  Recipe,
  RecipeInput,
  RecipeType,
  RecipeCategory,
  Difficulty,
  IngredientGroup,
  InstructionStep,
} from "@/types/recipe";
import type { ApiError } from "@/types";

interface RecipeFormProps {
  recipeType: RecipeType;
  initial?: Recipe;
  onSubmit: (input: RecipeInput) => Promise<void>;
  submitLabel: string;
}

export function RecipeForm({
  recipeType,
  initial,
  onSubmit,
  submitLabel,
}: RecipeFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<RecipeCategory | "">(
    initial?.category ?? ""
  );
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? "");
  const [tagsText, setTagsText] = useState(initial?.tags.join(", ") ?? "");
  const [primaryProtein, setPrimaryProtein] = useState(
    initial?.primary_protein ?? ""
  );
  const [prepTime, setPrepTime] = useState<string>(
    initial?.prep_time_minutes?.toString() ?? ""
  );
  const [cookTime, setCookTime] = useState<string>(
    initial?.cook_time_minutes?.toString() ?? ""
  );
  const [difficulty, setDifficulty] = useState<Difficulty | "">(
    initial?.difficulty ?? ""
  );
  const [servings, setServings] = useState<string>(
    initial?.servings?.toString() ?? ""
  );
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>(
    initial?.ingredient_groups ?? [{ ingredients: [] }]
  );
  const [instructions, setInstructions] = useState<InstructionStep[]>(
    initial?.instructions ?? []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isFull = recipeType === "full";
  const isQuickMeal = recipeType === "quick_meal";
  const isEvent = recipeType === "event";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const input: RecipeInput = {
      recipe_type: recipeType,
      title: title.trim(),
      description: description.trim() || null,
      notes: notes.trim() || null,
    };

    if (!isEvent) {
      input.cuisine = cuisine.trim() || null;
      input.tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      input.prep_time_minutes = prepTime ? Number(prepTime) : null;
      input.cook_time_minutes = cookTime ? Number(cookTime) : null;
      input.image_url = null;
    }

    if (isFull || isQuickMeal) {
      input.category = (category || null) as RecipeCategory | null;
      input.primary_protein = primaryProtein.trim() || null;
      input.servings = servings ? Number(servings) : null;
    }

    if (isFull) {
      input.difficulty = (difficulty || null) as Difficulty | null;
      input.source_url = sourceUrl.trim() || null;
      // Filter out empty groups/ingredients
      input.ingredient_groups = ingredientGroups
        .map((g) => ({
          ...g,
          ingredients: g.ingredients.filter((i) => i.name.trim()),
        }))
        .filter((g) => g.ingredients.length > 0);
      input.instructions = instructions.filter((s) => s.text.trim());
    }

    try {
      await onSubmit(input);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.error?.message || "Couldn't save the recipe");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            isEvent
              ? "e.g. Family dinner at mom's"
              : isQuickMeal
                ? "e.g. Frozen orange chicken"
                : "e.g. Beef stew"
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description{" "}
          <span className="text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      {/* Category + cuisine (full + quick_meal) */}
      {!isEvent && (
        <div className="grid grid-cols-2 gap-3">
          {!isEvent && (isFull || isQuickMeal) && (
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category{isFull && " *"}
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as RecipeCategory)}
                required={isFull}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
              >
                <option value="">Select...</option>
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="cuisine" className="block text-sm font-medium text-gray-700">
              Cuisine
            </label>
            <input
              id="cuisine"
              type="text"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="e.g. Italian"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
        </div>
      )}

      {/* Tags + protein (not events) */}
      {!isEvent && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="weeknight, kid-friendly"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
            <p className="mt-1 text-xs text-gray-400">Comma-separated</p>
          </div>

          {(isFull || isQuickMeal) && (
            <div>
              <label htmlFor="protein" className="block text-sm font-medium text-gray-700">
                Primary protein
              </label>
              <input
                id="protein"
                type="text"
                value={primaryProtein}
                onChange={(e) => setPrimaryProtein(e.target.value)}
                placeholder="e.g. chicken"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Time fields (not events) */}
      {!isEvent && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="prep" className="block text-sm font-medium text-gray-700">
              Prep (min)
            </label>
            <input
              id="prep"
              type="number"
              min={0}
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
          <div>
            <label htmlFor="cook" className="block text-sm font-medium text-gray-700">
              Cook (min)
            </label>
            <input
              id="cook"
              type="number"
              min={0}
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
          {(isFull || isQuickMeal) && (
            <div>
              <label htmlFor="servings" className="block text-sm font-medium text-gray-700">
                Servings{isFull && " *"}
              </label>
              <input
                id="servings"
                type="number"
                min={1}
                required={isFull}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Difficulty + source URL (full only) */}
      {isFull && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            >
              <option value="">—</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="source-url" className="block text-sm font-medium text-gray-700">
              Source URL
            </label>
            <input
              id="source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
        </div>
      )}

      {/* Ingredients (full only) */}
      {isFull && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Ingredients
          </label>
          <div className="mt-2">
            <IngredientEditor
              groups={ingredientGroups}
              onChange={setIngredientGroups}
            />
          </div>
        </div>
      )}

      {/* Instructions (full only) */}
      {isFull && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Instructions
          </label>
          <div className="mt-2">
            <InstructionEditor steps={instructions} onChange={setInstructions} />
          </div>
        </div>
      )}

      {/* Notes (all types) */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes{" "}
          <span className="text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            isQuickMeal
              ? "e.g. Trader Joe's, freezer aisle"
              : isEvent
                ? "e.g. At mom's house, 6pm"
                : ""
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-garnish-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 focus:outline-none focus:ring-2 focus:ring-garnish-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
