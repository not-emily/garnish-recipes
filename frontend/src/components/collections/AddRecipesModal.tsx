import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, Check, Plus } from "lucide-react";
import { listRecipes } from "@/api/recipes";
import { addRecipeToCollection } from "@/api/collections";

interface AddRecipesModalProps {
  open: boolean;
  onClose: () => void;
  collectionApikey: string;
  existingRecipeIds: string[];
}

export function AddRecipesModal({
  open,
  onClose,
  collectionApikey,
  existingRecipeIds,
}: AddRecipesModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["recipes", { q: search }],
    queryFn: () => listRecipes({ q: search || undefined }),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (recipeApikey: string) =>
      addRecipeToCollection(collectionApikey, recipeApikey),
    onSuccess: (_data, recipeApikey) => {
      setAddedIds((prev) => new Set(prev).add(recipeApikey));
      queryClient.invalidateQueries({ queryKey: ["collection", collectionApikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  if (!open) return null;

  const recipes = data?.data ?? [];
  const alreadyIn = new Set([...existingRecipeIds, ...addedIds]);

  function handleClose() {
    setSearch("");
    setAddedIds(new Set());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={handleClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
      />

      <div className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[80vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Recipes</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-100 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes..."
              autoFocus
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 sm:max-h-96">
          {recipes.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No recipes found.</p>
          ) : (
            <div className="space-y-1">
              {recipes.map((recipe) => {
                const isIn = alreadyIn.has(recipe.id);
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    disabled={isIn || addMutation.isPending}
                    onClick={() => addMutation.mutate(recipe.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-garnish-50 to-garnish-100">
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-garnish-300">
                          {(recipe.title ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {recipe.title}
                      </p>
                      {recipe.category && (
                        <p className="text-xs text-gray-400">{recipe.category}</p>
                      )}
                    </div>
                    {isIn ? (
                      <Check className="h-4 w-4 shrink-0 text-garnish-500" />
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
