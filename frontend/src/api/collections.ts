import { api } from "./client";
import type { ApiResponse } from "@/types";
import type { Collection, CollectionSummary, CollectionInput, CollectionShareEntry } from "@/types/collection";

export function listCollections(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api<ApiResponse<CollectionSummary[]>>(`/collections${qs}`);
}

export function getCollection(apikey: string) {
  return api<ApiResponse<Collection>>(`/collections/${apikey}`);
}

export function createCollection(input: CollectionInput) {
  return api<ApiResponse<CollectionSummary>>("/collections", {
    method: "POST",
    body: JSON.stringify({ collection: input }),
  });
}

export function updateCollection(apikey: string, input: Partial<CollectionInput>) {
  return api<ApiResponse<CollectionSummary>>(`/collections/${apikey}`, {
    method: "PATCH",
    body: JSON.stringify({ collection: input }),
  });
}

export function deleteCollection(apikey: string) {
  return api<void>(`/collections/${apikey}`, { method: "DELETE" });
}

export interface RecipeCollectionMembership {
  id: string;
  name: string;
  has_recipe: boolean;
}

export function getRecipeCollections(recipeApikey: string) {
  return api<ApiResponse<RecipeCollectionMembership[]>>(
    `/recipes/${recipeApikey}/collections`
  );
}

export function addRecipeToCollection(collectionApikey: string, recipeApikey: string) {
  return api<ApiResponse<{ collection_id: string; recipe_id: string }>>(
    `/collections/${collectionApikey}/recipes`,
    {
      method: "POST",
      body: JSON.stringify({ recipe_apikey: recipeApikey }),
    }
  );
}

export function removeRecipeFromCollection(collectionApikey: string, recipeApikey: string) {
  return api<void>(`/collections/${collectionApikey}/recipes/${recipeApikey}`, {
    method: "DELETE",
  });
}

// --- Sharing ---

export function listShares(collectionApikey: string) {
  return api<ApiResponse<CollectionShareEntry[]>>(
    `/collections/${collectionApikey}/shares`
  );
}

export function shareCollection(collectionApikey: string, email: string) {
  return api<ApiResponse<CollectionShareEntry>>(
    `/collections/${collectionApikey}/shares`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
}

export function revokeShare(collectionApikey: string, shareId: number) {
  return api<void>(`/collections/${collectionApikey}/shares/${shareId}`, {
    method: "DELETE",
  });
}

export function leaveCollection(collectionApikey: string) {
  return api<void>(`/collections/${collectionApikey}/leave`, {
    method: "DELETE",
  });
}

// --- Copy ---

export function copyRecipe(collectionApikey: string, recipeApikey: string) {
  return api<ApiResponse<{ id: string; title: string }>>(
    `/collections/${collectionApikey}/recipes/${recipeApikey}/copy`,
    { method: "POST" }
  );
}

// --- Export ---

export function getExportUrl(collectionApikey: string) {
  return `/api/v1/collections/${collectionApikey}/export`;
}
