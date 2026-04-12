import type { RecipeSummary } from "./recipe";

export interface CollectionSummary {
  id: string;
  name: string;
  description?: string | null;
  visibility: "private" | "household";
  recipe_count: number;
  is_mine: boolean;
  is_shared: boolean;
  share_count?: number | null;
  owner: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface CollectionShareEntry {
  id: number;
  user: { id: string; name: string; email: string };
  permission: string;
  created_at: string;
}

export interface Collection extends CollectionSummary {
  recipes: RecipeSummary[];
}

export interface CollectionInput {
  name: string;
  description?: string | null;
  visibility?: "private" | "household";
}
