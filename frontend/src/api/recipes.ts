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

// Image-staging intent paired with a recipe save. The picker emits this; the
// form passes it through to createRecipe / updateRecipe.
export type ImageStaging =
  | { kind: "none" }
  | { kind: "replace"; file: File }
  | { kind: "replace_url"; url: string }
  | { kind: "remove" };

export function createRecipe(input: RecipeInput, imageStaging: ImageStaging = { kind: "none" }) {
  if (imageStaging.kind === "none") {
    return api<ApiResponse<Recipe>>("/recipes", {
      method: "POST",
      body: JSON.stringify({ recipe: input }),
    });
  }
  return api<ApiResponse<Recipe>>("/recipes", {
    method: "POST",
    body: buildRecipeFormData(input, imageStaging),
  });
}

export function updateRecipe(
  apikey: string,
  input: Partial<RecipeInput>,
  imageStaging: ImageStaging = { kind: "none" }
) {
  if (imageStaging.kind === "none") {
    return api<ApiResponse<Recipe>>(`/recipes/${apikey}`, {
      method: "PATCH",
      body: JSON.stringify({ recipe: input }),
    });
  }
  return api<ApiResponse<Recipe>>(`/recipes/${apikey}`, {
    method: "PATCH",
    body: buildRecipeFormData(input, imageStaging),
  });
}

export function deleteRecipe(apikey: string) {
  return api<void>(`/recipes/${apikey}`, { method: "DELETE" });
}

// --- FormData encoding for nested recipe attrs + image ---

function buildRecipeFormData(input: Partial<RecipeInput>, imageStaging: ImageStaging): FormData {
  const fd = new FormData();
  appendNested(fd, "recipe", input);
  if (imageStaging.kind === "replace") {
    fd.append("recipe[image]", imageStaging.file);
  } else if (imageStaging.kind === "replace_url") {
    fd.append("recipe[image_url_to_fetch]", imageStaging.url);
  } else if (imageStaging.kind === "remove") {
    fd.append("recipe[remove_image]", "true");
  }
  return fd;
}

// Encodes a JS value in Rails' nested-params multipart notation:
//   { tags: ["a", "b"] }                 → tags[]=a, tags[]=b
//   { tags: [] }                         → tags[]=""  (controller compacts)
//   { ingredient_groups: [{ label: x }]} → ingredient_groups[0][label]=x
//   { description: null }                → description=""  (controller nils blanks)
//   { ingredient_groups: undefined }     → omitted entirely (no key emitted)
//
// undefined means "field not specified for this recipe type" (e.g. quick_meal
// has no ingredient_groups). Sending `key=""` for those would coerce arrays
// into strings on the Rails side and trip type validations. null is different:
// it means "user explicitly cleared a nullable scalar" — those go out as ""
// and the controller's NILIFY_BLANK normaliser maps them back to nil.
function appendNested(fd: FormData, key: string, value: unknown): void {
  if (value === undefined) return;
  if (value === null) {
    fd.append(key, "");
    return;
  }
  if (value instanceof Blob) {
    fd.append(key, value);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      fd.append(`${key}[]`, "");
      return;
    }
    value.forEach((item, i) => {
      if (item !== null && typeof item === "object" && !(item instanceof Blob)) {
        appendNested(fd, `${key}[${i}]`, item);
      } else {
        appendNested(fd, `${key}[]`, item);
      }
    });
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      appendNested(fd, `${key}[${k}]`, v);
    }
    return;
  }
  fd.append(key, String(value));
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
