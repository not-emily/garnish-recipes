import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check, Plus, Loader2 } from "lucide-react";
import {
  getRecipeCollections,
  addRecipeToCollection,
  removeRecipeFromCollection,
  createCollection,
} from "@/api/collections";
import type { CollectionInput } from "@/types/collection";

interface AddToCollectionModalProps {
  open: boolean;
  onClose: () => void;
  recipeApikey: string;
}

export function AddToCollectionModal({
  open,
  onClose,
  recipeApikey,
}: AddToCollectionModalProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["recipeCollections", recipeApikey],
    queryFn: () => getRecipeCollections(recipeApikey),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (collectionApikey: string) =>
      addRecipeToCollection(collectionApikey, recipeApikey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipeCollections", recipeApikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (collectionApikey: string) =>
      removeRecipeFromCollection(collectionApikey, recipeApikey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipeCollections", recipeApikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CollectionInput) => {
      const res = await createCollection(input);
      await addRecipeToCollection(res.data.id, recipeApikey);
    },
    onSuccess: () => {
      setNewName("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["recipeCollections", recipeApikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  if (!open) return null;

  const collections = data?.data ?? [];
  const isBusy = addMutation.isPending || removeMutation.isPending;

  function handleToggle(collectionId: string, hasRecipe: boolean) {
    if (hasRecipe) {
      removeMutation.mutate(collectionId);
    } else {
      addMutation.mutate(collectionId);
    }
  }

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate({ name: trimmed });
  }

  function handleClose() {
    setShowCreate(false);
    setNewName("");
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

      <div className="relative flex w-full max-w-sm flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Add to Collection
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 sm:max-h-80">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : collections.length === 0 && !showCreate ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No collections yet. Create one below.
            </p>
          ) : (
            <div className="space-y-0.5">
              {collections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleToggle(col.id, col.has_recipe)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      col.has_recipe
                        ? "border-garnish-600 bg-garnish-600"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {col.has_recipe && (
                      <Check className="h-3.5 w-3.5 text-white" />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {col.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create new collection inline */}
        <div className="border-t border-gray-100 p-3">
          {showCreate ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setShowCreate(false);
                    setNewName("");
                  }
                }}
                placeholder="Collection name"
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white hover:bg-garnish-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "..." : "Add"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              New Collection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
