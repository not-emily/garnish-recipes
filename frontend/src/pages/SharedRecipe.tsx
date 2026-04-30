import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Users, ChefHat, ExternalLink } from "lucide-react";
import { fetchSharedRecipe, copySharedRecipe } from "@/api/recipes";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionLoading } from "@/hooks/useSessionLoading";
import { useToast } from "@/components/ui/Toast";
import { MutationButton } from "@/components/ui/MutationButton";
import { RECIPE_CATEGORIES } from "@/types/recipe";
import { formatQuantity } from "@/lib/quantity";
import type { IngredientGroup, InstructionStep } from "@/types/recipe";

/**
 * Public read-only view of a recipe shared via `/r/shared/:token`. Mounted
 * outside the auth-protected shell: logged-out users can browse the recipe
 * and see a sign-up CTA; logged-in household members get a copy-to-household
 * button that clones the recipe into their active household and redirects
 * to the new copy.
 */
export function SharedRecipe() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const sessionLoading = useSessionLoading();
  const { toast } = useToast();

  // Gate the fetch on session loading: firing the query before the
  // AuthContext has restored the access token from the refresh cookie
  // means the request goes out without Authorization, the backend sees
  // no current_user, and can_copy comes back false — even for users
  // who are actually logged in. Waiting resolves fast for anonymous
  // viewers (no refresh cookie → immediate loaded state).
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sharedRecipe", token, isAuthenticated],
    queryFn: () => fetchSharedRecipe(token!),
    enabled: !!token && !sessionLoading,
  });

  const copyMutation = useMutation({
    mutationFn: () => copySharedRecipe(token!),
    onSuccess: (res) => {
      toast(`Saved "${res.data.title}" to your recipes`, "success");
      navigate(`/recipes/${res.data.id}`);
    },
    onError: () => toast("Couldn't save the recipe. Try again.", "error"),
  });

  if (sessionLoading || isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    const is404 = typeof error === "object" && error && "status" in error && (error as { status?: number }).status === 404;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          {is404 ? "This share link is no longer valid" : "Couldn't load the recipe"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {is404
            ? "The recipe may have been unshared or the link is mistyped."
            : "Check your connection and try again."}
        </p>
        <Link
          to="/recipes"
          className="mt-6 inline-block text-sm font-medium text-garnish-600 hover:text-garnish-700"
        >
          Go to Garnish
        </Link>
      </div>
    );
  }

  const recipe = data?.data;
  if (!recipe) return null;

  const categoryLabel = recipe.category
    ? RECIPE_CATEGORIES.find((c) => c.value === recipe.category)?.label
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Attribution */}
      <p className="text-xs text-gray-400">
        Shared from <span className="font-medium text-gray-600">{recipe.shared_by_household}</span>
      </p>

      {/* Header */}
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{recipe.title}</h1>
      {recipe.description && (
        <p className="mt-1 text-sm text-gray-600">{recipe.description}</p>
      )}

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

      {(categoryLabel || recipe.cuisine || recipe.tags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categoryLabel && (
            <span className="rounded-full bg-garnish-50 px-2 py-0.5 text-xs font-medium text-garnish-700">
              {categoryLabel}
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
      )}

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

      {/* CTA block — copy-to-household for authenticated users, sign-up for anonymous */}
      <div className="mt-6 rounded-xl border border-garnish-200 bg-garnish-50 p-4">
        {recipe.can_copy ? (
          <>
            <p className="text-sm text-garnish-900">
              Save this recipe to your household so you can meal-plan it, edit
              it, and keep it forever.
            </p>
            <MutationButton
              type="button"
              pending={copyMutation.isPending}
              onClick={() => copyMutation.mutate()}
              className="mt-3 w-full rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white hover:bg-garnish-700"
            >
              Add to my recipes
            </MutationButton>
          </>
        ) : isAuthenticated ? (
          <>
            <p className="text-sm text-garnish-900">
              Finish setting up your household to save this recipe.
            </p>
            <Link
              to="/onboarding"
              className="mt-3 inline-block w-full rounded-lg bg-garnish-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-garnish-700"
            >
              Complete setup
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-garnish-900">
              Sign up for Garnish to save this recipe and plan meals around it.
            </p>
            <Link
              to="/signup"
              className="mt-3 inline-block w-full rounded-lg bg-garnish-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-garnish-700"
            >
              Sign up to save
            </Link>
          </>
        )}
      </div>

      {/* Ingredients */}
      {Array.isArray(recipe.ingredient_groups) && recipe.ingredient_groups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          {(recipe.ingredient_groups as IngredientGroup[]).map((group, gi) => (
            <div key={gi} className="mt-3">
              {group.label && (
                <h3 className="text-sm font-medium text-gray-600">{group.label}</h3>
              )}
              <ul className="mt-2 space-y-1">
                {group.ingredients?.map((ing, ii) => (
                  <li key={ii} className="text-sm text-gray-700">
                    {formatIngredient(ing)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Instructions */}
      {Array.isArray(recipe.instructions) && recipe.instructions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <ol className="mt-3 space-y-3">
            {(recipe.instructions as InstructionStep[]).map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 font-medium text-gray-400">{i + 1}.</span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}

function formatIngredient(ing: {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  preparation?: string | null;
  optional?: boolean | null;
}): string {
  const parts: string[] = [];
  if (ing.quantity != null) {
    const qty = formatQuantity(ing.quantity, ing.unit);
    if (qty) parts.push(qty);
  }
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  let s = parts.join(" ");
  if (ing.preparation) s += `, ${ing.preparation}`;
  if (ing.optional) s += " (optional)";
  return s;
}

export default SharedRecipe;
