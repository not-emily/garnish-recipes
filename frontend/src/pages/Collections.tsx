import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCollections, createCollection } from "@/api/collections";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { RecipePageTabs } from "@/components/recipes/RecipePageTabs";
import type { CollectionInput } from "@/types/collection";

export function Collections() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CollectionInput) => createCollection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const collections = data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700"
        >
          <Plus className="h-4 w-4" />
          New Collection
        </button>
      </div>

      <RecipePageTabs active="collections" />

      {isLoading ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">No collections yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Create one to organize your favorite recipes.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </div>
      )}

      <CollectionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
        title="New Collection"
      />
    </div>
  );
}

export default Collections;
