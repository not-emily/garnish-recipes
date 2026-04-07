export type RecipeType = "full" | "quick_meal" | "event";

export type RecipeCategory =
  | "entree"
  | "side"
  | "appetizer"
  | "soup_stew"
  | "salad"
  | "breakfast"
  | "dessert"
  | "snack"
  | "beverage"
  | "sauce_dressing";

export type Difficulty = "easy" | "medium" | "hard";

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: "entree", label: "Entrée" },
  { value: "side", label: "Side" },
  { value: "appetizer", label: "Appetizer" },
  { value: "soup_stew", label: "Soup / Stew" },
  { value: "salad", label: "Salad" },
  { value: "breakfast", label: "Breakfast" },
  { value: "dessert", label: "Dessert" },
  { value: "snack", label: "Snack" },
  { value: "beverage", label: "Beverage" },
  { value: "sauce_dressing", label: "Sauce / Dressing" },
];

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const COMMON_UNITS = [
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "lbs",
  "g",
  "kg",
  "ml",
  "l",
  "clove",
  "cloves",
  "pinch",
  "dash",
  "can",
  "cans",
  "package",
];

export interface Ingredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  preparation?: string | null;
  optional?: boolean;
}

export interface IngredientGroup {
  label?: string | null;
  ingredients: Ingredient[];
}

export interface InstructionStep {
  step: number;
  text: string;
  timer_minutes?: number | null;
}

export interface RecipeSummary {
  id: string;
  recipe_type: RecipeType;
  title: string;
  description?: string | null;
  category?: RecipeCategory | null;
  cuisine?: string | null;
  tags: string[];
  primary_protein?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null;
  difficulty?: Difficulty | null;
  servings?: number | null;
  image_url?: string | null;
  times_cooked: number;
  last_cooked_at?: string | null;
  updated_at: string;
}

export type ImportStatus = "importing" | "complete" | "needs_review" | "failed";
export type ImportSourceType = "url" | "pdf" | "image";

export interface Recipe extends RecipeSummary {
  source_url?: string | null;
  notes?: string | null;
  ingredient_groups: IngredientGroup[];
  instructions: InstructionStep[];
  contributed_by: { id: string; name: string };
  import_status?: ImportStatus | null;
  import_source_type?: ImportSourceType | null;
  import_error?: string | null;
}

export interface ImportSummary {
  id: string;
  import_status: ImportStatus;
  import_source_type: ImportSourceType;
  import_error?: string | null;
  import_completed_at?: string | null;
  source_url?: string | null;
  title?: string | null;
}

export interface RecipeInput {
  recipe_type: RecipeType;
  title: string;
  description?: string | null;
  category?: RecipeCategory | null;
  cuisine?: string | null;
  tags?: string[];
  primary_protein?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  difficulty?: Difficulty | null;
  servings?: number | null;
  source_url?: string | null;
  notes?: string | null;
  image_url?: string | null;
  ingredient_groups?: IngredientGroup[];
  instructions?: InstructionStep[];
}

export interface RecipeFilters {
  q?: string;
  recipe_type?: RecipeType;
  category?: RecipeCategory;
  cuisine?: string;
  protein?: string;
  difficulty?: Difficulty;
  tags?: string[];
  max_time?: number;
  sort?: "title" | "recently_cooked" | "prep_time" | "updated_at";
}
