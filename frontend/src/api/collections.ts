import { api } from "./client";
import type { ApiResponse } from "@/types";
import type { Collection, CollectionSummary, CollectionInput } from "@/types/collection";

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
