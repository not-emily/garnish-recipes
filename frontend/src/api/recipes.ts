import { api } from "./client";
import type { ApiResponse } from "@/types";
import type { Recipe, RecipeSummary, RecipeInput, RecipeFilters, SmartSections } from "@/types/recipe";

function buildQueryString(filters: RecipeFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.recipe_type) params.set("recipe_type", filters.recipe_type);
  if (filters.category) params.set("category", filters.category);
  if (filters.cuisine) params.set("cuisine", filters.cuisine);
  if (filters.protein) params.set("protein", filters.protein);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.max_time) params.set("max_time", String(filters.max_time));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.tags?.length) {
    filters.tags.forEach((t) => params.append("tags[]", t));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listRecipes(filters: RecipeFilters = {}) {
  return api<ApiResponse<RecipeSummary[]>>(`/recipes${buildQueryString(filters)}`);
}

export function getSmartSections() {
  return api<ApiResponse<SmartSections>>("/recipes/smart_sections");
}

export function getRecipe(apikey: string, collectionApikey?: string) {
  const qs = collectionApikey ? `?collection=${encodeURIComponent(collectionApikey)}` : "";
  return api<ApiResponse<Recipe>>(`/recipes/${apikey}${qs}`);
}

export function createRecipe(input: RecipeInput) {
  return api<ApiResponse<Recipe>>("/recipes", {
    method: "POST",
    body: JSON.stringify({ recipe: input }),
  });
}

export function updateRecipe(apikey: string, input: Partial<RecipeInput>) {
  return api<ApiResponse<Recipe>>(`/recipes/${apikey}`, {
    method: "PATCH",
    body: JSON.stringify({ recipe: input }),
  });
}

export function deleteRecipe(apikey: string) {
  return api<void>(`/recipes/${apikey}`, { method: "DELETE" });
}

// --- Sharing ---

export interface ShareLink {
  share_token: string;
  share_url: string;
}

export interface SharedRecipeView {
  id: string;
  recipe_type: string;
  title: string;
  description: string | null;
  category: string | null;
  cuisine: string | null;
  tags: string[];
  primary_protein: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  difficulty: string | null;
  servings: number | null;
  image_url: string | null;
  image_thumb_url: string | null;
  image_detail_url: string | null;
  source_url: string | null;
  notes: string | null;
  ingredient_groups: unknown[];
  instructions: unknown[];
  shared_by_household: string;
  can_copy: boolean;
}

export function shareRecipe(apikey: string) {
  return api<ApiResponse<ShareLink>>(`/recipes/${apikey}/share`, {
    method: "POST",
  });
}

export function revokeShare(apikey: string) {
  return api<void>(`/recipes/${apikey}/share`, { method: "DELETE" });
}

export function fetchSharedRecipe(token: string) {
  return api<ApiResponse<SharedRecipeView>>(`/shared_recipes/${token}`);
}

export function copySharedRecipe(token: string) {
  return api<ApiResponse<{ id: string; title: string }>>(
    `/shared_recipes/${token}/copy`,
    { method: "POST" }
  );
}
