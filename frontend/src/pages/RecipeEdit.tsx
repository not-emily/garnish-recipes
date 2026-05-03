import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getRecipe, updateRecipe, type ImageStaging } from "@/api/recipes";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import type { RecipeInput } from "@/types/recipe";

export function RecipeEdit() {
  const { apikey } = useParams<{ apikey: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["recipe", apikey],
    queryFn: () => getRecipe(apikey!),
    enabled: !!apikey,
  });

  const mutation = useMutation({
    mutationFn: ({ input, imageStaging }: { input: RecipeInput; imageStaging: ImageStaging }) =>
      updateRecipe(apikey!, input, imageStaging),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      // Recipe detail key is `["recipe", apikey, collectionApikey]` — partial-match
      // invalidate hits all variants so the detail page refetches on mount.
      queryClient.invalidateQueries({ queryKey: ["recipe", apikey] });
      // Image change touches multiple cache surfaces (browse cards, smart sections, collections).
      if (vars.imageStaging.kind !== "none") {
        queryClient.invalidateQueries({ queryKey: ["smart-sections"] });
        queryClient.invalidateQueries({ queryKey: ["collections"] });
      }
      navigate(`/recipes/${res.data.id}`);
    },
  });

  if (isLoading || !data?.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <div className="h-8 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const recipe = data.data;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-8">
      <Link
        to={`/recipes/${recipe.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Edit {recipe.title}</h1>

      <div className="mt-6">
        <RecipeForm
          recipeType={recipe.recipe_type}
          initial={recipe}
          onSubmit={async (input, imageStaging) => {
            await mutation.mutateAsync({ input, imageStaging });
          }}
          submitLabel="Save"
        />
      </div>
    </div>
  );
}

export default RecipeEdit;
