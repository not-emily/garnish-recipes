import { api } from "./client";
import type { ApiResponse } from "@/types";
import type {
  MealPlan,
  MealPlanEntry,
  CreateEntryInput,
  UpdateEntryInput,
} from "@/types/mealPlan";

// Week start is normalised to a Monday. Any date within the target week is
// acceptable — the backend canonicalises it.
export function getMealPlan(weekStart: string) {
  return api<ApiResponse<MealPlan>>(`/meal_plans/${weekStart}`);
}

export function createMealPlanEntry(weekStart: string, input: CreateEntryInput) {
  return api<ApiResponse<MealPlanEntry>>(`/meal_plans/${weekStart}/entries`, {
    method: "POST",
    body: JSON.stringify({ entry: input }),
  });
}

export function updateMealPlanEntry(
  weekStart: string,
  entryId: number,
  input: UpdateEntryInput
) {
  return api<ApiResponse<MealPlanEntry>>(
    `/meal_plans/${weekStart}/entries/${entryId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ entry: input }),
    }
  );
}

export function deleteMealPlanEntry(weekStart: string, entryId: number) {
  return api<void>(`/meal_plans/${weekStart}/entries/${entryId}`, {
    method: "DELETE",
  });
}

export function reorderMealPlanEntries(weekStart: string, entryIds: number[]) {
  return api<ApiResponse<MealPlanEntry[]>>(
    `/meal_plans/${weekStart}/entries/reorder`,
    {
      method: "POST",
      body: JSON.stringify({ entry_ids: entryIds }),
    }
  );
}
