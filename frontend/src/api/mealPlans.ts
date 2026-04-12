import { api } from "./client";
import type { ApiResponse } from "@/types";
import type {
  MealPlan,
  MealPlanEntry,
  CreateEntryInput,
  CreateEntryResponse,
  UpdateEntryInput,
} from "@/types/mealPlan";

// Week start is normalised to a Monday. Any date within the target week is
// acceptable — the backend canonicalises it.
export function getMealPlan(weekStart: string) {
  return api<ApiResponse<MealPlan>>(`/meal_plans/${weekStart}`);
}

export function createMealPlanEntry(weekStart: string, input: CreateEntryInput) {
  const { leftovers, track_remaining, ...entry } = input;
  return api<CreateEntryResponse>(`/meal_plans/${weekStart}/entries`, {
    method: "POST",
    body: JSON.stringify({ entry, leftovers, track_remaining }),
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

export function deleteMealPlanEntry(
  weekStart: string,
  entryId: number,
  opts?: { cascade?: boolean }
) {
  const qs = opts?.cascade ? "?cascade=true" : "";
  return api<void>(`/meal_plans/${weekStart}/entries/${entryId}${qs}`, {
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
