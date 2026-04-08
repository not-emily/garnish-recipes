import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMealPlan,
  createMealPlanEntry,
  updateMealPlanEntry,
  deleteMealPlanEntry,
} from "@/api/mealPlans";
import type {
  CreateEntryInput,
  UpdateEntryInput,
  MealPlan,
} from "@/types/mealPlan";

/**
 * Fetches a meal plan week and exposes mutation helpers that optimistically
 * update the cache. All mutations invalidate on settle so we re-sync with
 * server truth after each change.
 */
export function useMealPlan(weekStart: string) {
  const queryClient = useQueryClient();
  const queryKey = ["mealPlan", weekStart] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getMealPlan(weekStart),
  });

  const createEntry = useMutation({
    mutationFn: (input: CreateEntryInput) =>
      createMealPlanEntry(weekStart, input),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            entries: [...old.data.entries, res.data].sort(entryOrder),
          },
        };
      });
    },
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateEntryInput }) =>
      updateMealPlanEntry(weekStart, id, input),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            entries: old.data.entries
              .map((e) => (e.id === res.data.id ? res.data : e))
              .sort(entryOrder),
          },
        };
      });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => deleteMealPlanEntry(weekStart, id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            entries: old.data.entries.filter((e) => e.id !== id),
          },
        };
      });
    },
  });

  return {
    mealPlan: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}

// Sort by (date, meal_slot_order, position) to match the backend scope
// and keep the UI stable after any mutation.
const MEAL_SLOT_ORDER: Record<string, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};

function entryOrder(
  a: { date: string; meal_slot: string; position: number },
  b: { date: string; meal_slot: string; position: number }
) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.meal_slot !== b.meal_slot)
    return MEAL_SLOT_ORDER[a.meal_slot] - MEAL_SLOT_ORDER[b.meal_slot];
  return a.position - b.position;
}
