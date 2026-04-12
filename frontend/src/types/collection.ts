import type { RecipeSummary } from "./recipe";

export interface CollectionSummary {
  id: string;
  name: string;
  description?: string | null;
  visibility: "private" | "household";
  recipe_count: number;
  is_mine: boolean;
  owner: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface Collection extends CollectionSummary {
  recipes: RecipeSummary[];
}

export interface CollectionInput {
  name: string;
  description?: string | null;
  visibility?: "private" | "household";
}
