import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, Plus } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  getCollection,
  updateCollection,
  deleteCollection,
  removeRecipeFromCollection,
} from "@/api/collections";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { AddRecipesModal } from "@/components/collections/AddRecipesModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { CollectionInput } from "@/types/collection";

export function CollectionDetail() {
  const { apikey } = useParams<{ apikey: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; title: string } | null>(null);
  const isDesktopHover = useMediaQuery("(min-width: 1024px) and (hover: hover)");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["collection", apikey],
    queryFn: () => getCollection(apikey!),
    enabled: !!apikey,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(apikey!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      navigate("/collections");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: Partial<CollectionInput>) => updateCollection(apikey!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection", apikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (recipeApikey: string) => removeRecipeFromCollection(apikey!, recipeApikey),
    onSuccess: () => {
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["collection", apikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
        <p className="text-gray-500">Collection not found.</p>
        <Link to="/collections" className="mt-2 text-sm text-garnish-600 hover:underline">
          Back to collections
        </Link>
      </div>
    );
  }

  const collection = data.data;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/collections"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Collections
        </Link>

        {collection.is_mine && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Edit collection"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Delete collection"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collection info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
        {collection.description && (
          <p className="mt-1 text-sm text-gray-500">{collection.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span>
            {collection.recipe_count} {collection.recipe_count === 1 ? "recipe" : "recipes"}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
            {collection.visibility === "private" ? "Private" : "Household"}
          </span>
          {!collection.is_mine && <span>by {collection.owner.name}</span>}
        </div>
      </div>

      {/* Add recipes button */}
      {collection.is_mine && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mb-4 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Add Recipes
        </button>
      )}

      {/* Recipe grid */}
      {collection.recipes.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No recipes in this collection yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {collection.recipes.map((recipe) => (
            <div key={recipe.id} className="group/card relative">
              <RecipeCard recipe={recipe} />
              {collection.is_mine && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRemoveTarget({ id: recipe.id, title: recipe.title });
                  }}
                  className={`absolute right-1 top-1 z-10 rounded-full bg-white/90 p-1 text-gray-400 shadow-sm backdrop-blur-sm transition-opacity hover:text-red-500 ${
                    isDesktopHover
                      ? "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
                      : "opacity-100"
                  }`}
                  aria-label={`Remove ${recipe.title} from collection`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <CollectionForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={async (input) => {
          await updateMutation.mutateAsync(input);
        }}
        initial={{
          name: collection.name,
          description: collection.description,
          visibility: collection.visibility,
        }}
        title="Edit Collection"
      />

      {/* Add recipes modal */}
      <AddRecipesModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        collectionApikey={apikey!}
        existingRecipeIds={collection.recipes.map((r) => r.id)}
      />

      {/* Delete collection confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${collection.name}"?`}
        message="This will delete the collection but not the recipes themselves."
        confirmLabel="Delete"
        variant="danger"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Remove recipe confirmation */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove from collection?"
        message={
          removeTarget
            ? `Remove "${removeTarget.title}" from this collection? The recipe itself won't be deleted.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        isSubmitting={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget.id);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
