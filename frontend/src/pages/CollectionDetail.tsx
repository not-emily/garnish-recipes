import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Share2,
  Download,
  Copy,
  Check,
  MoreVertical,
  LogOut,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getAccessToken } from "@/api/client";
import {
  getCollection,
  updateCollection,
  deleteCollection,
  removeRecipeFromCollection,
  copyRecipe,
  leaveCollection,
  getExportUrl,
} from "@/api/collections";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { AddRecipesModal } from "@/components/collections/AddRecipesModal";
import { ShareModal } from "@/components/collections/ShareModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import type { CollectionInput } from "@/types/collection";

export function CollectionDetail() {
  const { apikey } = useParams<{ apikey: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; title: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
      toast("Collection deleted");
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

  const leaveMutation = useMutation({
    mutationFn: () => leaveCollection(apikey!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast("Left collection");
      navigate("/collections");
    },
  });

  const copyMutation = useMutation({
    mutationFn: (recipeApikey: string) => copyRecipe(apikey!, recipeApikey),
    onSuccess: (_res, recipeApikey) => {
      setCopiedId(recipeApikey);
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast("Copied to your recipes");
      setTimeout(() => setCopiedId(null), 2000);
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

  function handleExport() {
    const url = getExportUrl(apikey!);
    const token = getAccessToken();
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${collection.name.toLowerCase().replace(/\s+/g, "-")}-recipes.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

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

        <div className="flex items-center gap-1">
          {collection.is_mine && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Edit collection"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}

          <DropdownMenu
            trigger={<MoreVertical className="h-4 w-4" />}
          >
            {collection.is_mine && (
              <DropdownItem
                onClick={() => setShareOpen(true)}
                icon={<Share2 className="h-4 w-4" />}
                label="Share"
              />
            )}
            <DropdownItem
              onClick={handleExport}
              icon={<Download className="h-4 w-4" />}
              label="Export as JSON"
            />
            {collection.is_shared && (
              <DropdownItem
                onClick={() => setConfirmLeave(true)}
                icon={<LogOut className="h-4 w-4" />}
                label="Leave collection"
                variant="danger"
              />
            )}
            {collection.is_mine && (
              <DropdownItem
                onClick={() => setConfirmDelete(true)}
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete collection"
                variant="danger"
              />
            )}
          </DropdownMenu>
        </div>
      </div>

      {/* Collection info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
        {collection.description && (
          <p className="mt-1 text-sm text-gray-500">{collection.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span>
            {collection.recipe_count} {collection.recipe_count === 1 ? "recipe" : "recipes"}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
            {collection.visibility === "private" ? "Private" : "Household"}
          </span>
          {collection.is_shared && <span>Shared by {collection.owner.name}</span>}
          {!collection.is_shared && !collection.is_mine && (
            <span>by {collection.owner.name}</span>
          )}
          {collection.is_mine && collection.share_count != null && collection.share_count > 0 && (
            <span>
              Shared with {collection.share_count}{" "}
              {collection.share_count === 1 ? "person" : "people"}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {collection.is_mine && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add Recipes
          </button>
        </div>
      )}

      {/* Recipe grid */}
      {collection.recipes.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No recipes in this collection yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {collection.recipes.map((recipe) => {
            const wasCopied = copiedId === recipe.id;
            return (
              <div key={recipe.id} className="group/card relative">
                <RecipeCard
                recipe={recipe}
                linkState={{
                  from: "collection",
                  collectionApikey: apikey,
                  collectionName: collection.name,
                  isSharedCollection: collection.is_shared,
                }}
              />

                {/* Owner: remove button */}
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

                {/* Shared: copy button */}
                {collection.is_shared && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!wasCopied) copyMutation.mutate(recipe.id);
                    }}
                    disabled={wasCopied || copyMutation.isPending}
                    className={`absolute right-1 top-1 z-10 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shadow-sm backdrop-blur-sm transition-all ${
                      wasCopied
                        ? "bg-garnish-500 text-white opacity-100"
                        : `bg-white/90 text-gray-600 hover:bg-garnish-50 hover:text-garnish-700 ${
                            isDesktopHover
                              ? "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
                              : "opacity-100"
                          }`
                    }`}
                    aria-label={
                      wasCopied ? "Copied!" : `Copy ${recipe.title} to my recipes`
                    }
                  >
                    {wasCopied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
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

      {/* Share modal */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        collectionApikey={apikey!}
        collectionName={collection.name}
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

      {/* Leave collection confirmation */}
      <ConfirmDialog
        open={confirmLeave}
        title="Leave collection?"
        message={`You'll no longer see "${collection.name}" in your collections. You can ask ${collection.owner.name} to re-share it later.`}
        confirmLabel="Leave"
        variant="danger"
        isSubmitting={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
        onCancel={() => setConfirmLeave(false)}
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

export default CollectionDetail;
