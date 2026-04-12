import { useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Users,
  ChefHat,
  Trash2,
  Pencil,
  Download,
  ExternalLink,
  Timer,
  AlertCircle,
  FolderPlus,
  Copy,
  Check,
} from "lucide-react";
import { getRecipe, deleteRecipe } from "@/api/recipes";
import { copyRecipe } from "@/api/collections";
import { useHousehold } from "@/contexts/HouseholdContext";
import { RECIPE_CATEGORIES } from "@/types/recipe";
import { ImportProgress } from "@/components/recipes/ImportProgress";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { RatingStars } from "@/components/recipes/RatingStars";
import { upsertRating, deleteRating } from "@/api/ratings";

export function RecipeDetail() {
  const { apikey } = useParams<{ apikey: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { household } = useHousehold();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  const canEdit =
    household?.my_role === "owner" || household?.my_role === "admin";

  const [copied, setCopied] = useState(false);

  // Referrer-aware back link and collection context for shared recipes.
  const locState = location.state as {
    from?: string;
    collectionApikey?: string;
    collectionName?: string;
    isSharedCollection?: boolean;
  } | null;

  const collectionApikey = locState?.collectionApikey;
  const isSharedRecipe = locState?.isSharedCollection === true;

  const backLink =
    locState?.from === "mealPlan"
      ? { to: "/meal-plan", label: "Meal Plan" }
      : locState?.from === "collection" && collectionApikey
        ? { to: `/collections/${collectionApikey}`, label: locState.collectionName ?? "Collection" }
        : { to: "/recipes", label: "Recipes" };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["recipe", apikey, collectionApikey],
    queryFn: () => getRecipe(apikey!, collectionApikey),
    enabled: !!apikey,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecipe(apikey!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      navigate("/recipes");
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => copyRecipe(collectionApikey!, apikey!),
    onSuccess: () => {
      setCopied(true);
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setTimeout(() => setCopied(false), 3000);
    },
  });

  const queryKey = ["recipe", apikey, collectionApikey] as const;

  const rateMutation = useMutation({
    mutationFn: (score: number | null) =>
      score === null ? deleteRating(apikey!) : upsertRating(apikey!, score),
    onMutate: (score) => {
      queryClient.setQueryData(
        queryKey,
        (old: { data: typeof recipe } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: { ...old.data, my_rating: score },
          };
        }
      );
    },
    onSuccess: (res) => {
      queryClient.setQueryData(
        queryKey,
        (old: { data: typeof recipe } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              my_rating: "score" in res.data ? res.data.score : null,
              average_rating: res.data.average_rating,
              rating_count: res.data.rating_count,
            },
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["smart-sections"] });
    },
  });

  function handleDelete() {
    setConfirmDelete(true);
  }

  function handleExport() {
    if (!data?.data) return;
    const blob = new Blob([JSON.stringify(data.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.data.title.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <p className="text-sm text-gray-500">Couldn't load this recipe.</p>
        <Link to={backLink.to} className="text-sm text-garnish-600 hover:underline">
          ← Back to {backLink.label}
        </Link>
      </div>
    );
  }

  const recipe = data.data;

  // In-progress or failed import: short-circuit the regular detail view.
  // The polling progress card calls invalidate("recipe", apikey) on completion,
  // which re-renders this page into the normal recipe view.
  if (recipe.import_status === "importing" || recipe.import_status === "failed") {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-8">
        <div className="mb-4">
          <Link
            to={backLink.to}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLink.label}
          </Link>
        </div>
        <ImportProgress
          apikey={recipe.id}
          status={recipe.import_status}
          sourceUrl={recipe.source_url}
          errorMessage={recipe.import_error}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to={backLink.to}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLink.label}
        </Link>

        {isSharedRecipe ? (
          <button
            type="button"
            onClick={() => copyMutation.mutate()}
            disabled={copied || copyMutation.isPending}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
              copied
                ? "bg-garnish-600 text-white"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied to My Recipes
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to My Recipes
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollectionModalOpen(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Add to collection"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            {canEdit && (
              <>
                <Link
                  to={`/recipes/${recipe.id}/edit`}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Edit recipe"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Export recipe"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete recipe"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Needs-review banner — shown for recipes that were imported but
          couldn't be fully parsed (no JSON-LD, missing fields, image-only PDF, etc.) */}
      {recipe.import_status === "needs_review" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900">Needs your review</h3>
              <p className="mt-1 text-sm text-amber-800">
                {recipe.import_error
                  ? recipe.import_error
                  : "We imported this recipe but couldn't extract all the details. Tap edit to fill in the missing fields."}
              </p>
              {canEdit && (
                <Link
                  to={`/recipes/${recipe.id}/edit`}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit recipe
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-garnish-50 to-garnish-100">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl text-garnish-300">
            {recipe.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mt-4">
        <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-1 text-sm text-gray-600">{recipe.description}</p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {recipe.total_time_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {recipe.total_time_minutes} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {recipe.servings} servings
            </span>
          )}
          {recipe.difficulty && (
            <span className="flex items-center gap-1">
              <ChefHat className="h-4 w-4" />
              {recipe.difficulty}
            </span>
          )}
        </div>

        {/* Taxonomy */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.category && (
            <span className="rounded-full bg-garnish-50 px-2 py-0.5 text-xs font-medium text-garnish-700">
              {RECIPE_CATEGORIES.find((c) => c.value === recipe.category)?.label}
            </span>
          )}
          {recipe.cuisine && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {recipe.cuisine}
            </span>
          )}
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              #{tag}
            </span>
          ))}
        </div>

        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-garnish-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Original source
          </a>
        )}
      </div>

      {/* Notes (for quick meals and events) */}
      {recipe.notes && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{recipe.notes}</p>
        </section>
      )}

      {/* Rating */}
      {!isSharedRecipe && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500">Your Rating</h2>
              <div className="mt-1">
                <RatingStars
                  value={recipe.my_rating}
                  onChange={(score) => rateMutation.mutate(score)}
                />
              </div>
            </div>
            {recipe.rating_count > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-500">Household</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <RatingStars value={recipe.average_rating ?? 0} readonly size="sm" />
                  <span className="text-sm text-gray-500">
                    {recipe.average_rating?.toFixed(1)} ({recipe.rating_count})
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Ingredients */}
      {recipe.ingredient_groups.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <div className="mt-2 space-y-4">
            {recipe.ingredient_groups.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <h3 className="mb-1 text-sm font-medium text-gray-700">
                    {group.label}
                  </h3>
                )}
                <ul className="space-y-1.5">
                  {group.ingredients.map((ing, ii) => (
                    <li
                      key={ii}
                      className="flex items-baseline gap-2 text-sm text-gray-700"
                    >
                      <span className="text-garnish-500">•</span>
                      <span>
                        {ing.quantity && (
                          <strong className="font-medium">
                            {ing.quantity}
                            {ing.unit ? ` ${ing.unit}` : ""}{" "}
                          </strong>
                        )}
                        {ing.name}
                        {ing.preparation && (
                          <span className="text-gray-500">
                            , {ing.preparation}
                          </span>
                        )}
                        {ing.optional && (
                          <span className="ml-1 text-xs text-gray-400">
                            (optional)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Instructions */}
      {recipe.instructions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <ol className="mt-2 space-y-3">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-garnish-100 text-xs font-semibold text-garnish-700">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {step.text}
                  </p>
                  {step.timer_minutes && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400">
                      <Timer className="h-3 w-3" />
                      {step.timer_minutes} min
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400">
        Added by {recipe.contributed_by.name}
      </p>

      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        recipeApikey={recipe.id}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete recipe?"
        message="This can't be undone. The recipe will be permanently deleted."
        confirmLabel="Delete"
        variant="danger"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
