export type GroceryCategory =
  | "produce"
  | "dairy"
  | "meat"
  | "seafood"
  | "deli"
  | "bakery"
  | "frozen_premade"
  | "canned_jarred"
  | "pasta_grains"
  | "condiments_sauces"
  | "oils_vinegars"
  | "spices"
  | "baking"
  | "snacks"
  | "cereal_breakfast"
  | "beverages"
  | "pantry"
  | "household"
  | "health_beauty"
  | "other";

export const GROCERY_CATEGORIES: {
  value: GroceryCategory;
  label: string;
  emoji: string;
}[] = [
  { value: "produce", label: "Produce", emoji: "🥬" },
  { value: "dairy", label: "Dairy & Eggs", emoji: "🥛" },
  { value: "meat", label: "Meat", emoji: "🥩" },
  { value: "seafood", label: "Seafood", emoji: "🐟" },
  { value: "deli", label: "Deli", emoji: "🥪" },
  { value: "bakery", label: "Bakery", emoji: "🍞" },
  { value: "frozen_premade", label: "Frozen / Pre-made", emoji: "🧊" },
  { value: "canned_jarred", label: "Canned & Jarred", emoji: "🥫" },
  { value: "pasta_grains", label: "Pasta & Grains", emoji: "🍝" },
  { value: "condiments_sauces", label: "Condiments & Sauces", emoji: "🫙" },
  { value: "oils_vinegars", label: "Oils & Vinegars", emoji: "🫒" },
  { value: "spices", label: "Spices & Seasonings", emoji: "🧂" },
  { value: "baking", label: "Baking", emoji: "🧁" },
  { value: "snacks", label: "Snacks", emoji: "🍿" },
  { value: "cereal_breakfast", label: "Cereal & Breakfast", emoji: "🥣" },
  { value: "beverages", label: "Beverages", emoji: "🥤" },
  { value: "pantry", label: "Pantry", emoji: "🏪" },
  { value: "household", label: "Household", emoji: "🏠" },
  { value: "health_beauty", label: "Health & Beauty", emoji: "🧴" },
  { value: "other", label: "Other", emoji: "📦" },
];

export interface GrocerySourceEntry {
  entry_id: number;
  title: string;
  removed?: boolean;
}

export interface GroceryListItem {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: GroceryCategory;
  store: string | null;
  source_type: "recipe" | "quick_meal" | "manual";
  source_entries: GrocerySourceEntry[];
  checked: boolean;
  position: number;
  added_by: {
    id: string;
    name: string;
  };
  // Client-only flag: set to true while an optimistic mutation is in-flight.
  // Components render pending items at reduced opacity so users can see their
  // action hasn't confirmed yet. Cleared once the server response replaces
  // the entry (or removed entirely on failure via rollback).
  _pending?: boolean;
}

export interface IngredientMapping {
  name: string;
  category: GroceryCategory;
  store: string | null;
}

export interface GroceryList {
  generated_from: string | null;
  generated_to: string | null;
  items: GroceryListItem[];
  mappings: IngredientMapping[];
}
