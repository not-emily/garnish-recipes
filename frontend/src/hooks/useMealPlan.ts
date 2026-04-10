import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getMealPlan,
  createMealPlanEntry,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  reorderMealPlanEntries,
} from "@/api/mealPlans";
import type {
  CreateEntryInput,
  UpdateEntryInput,
  MealPlan,
  MealPlanEntry,
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
    // Keep the previous week's data on-screen while the new week loads,
    // so MobileDayView stays mounted during cross-week swipe navigation
    // (avoids unmount → remount → state loss).
    placeholderData: keepPreviousData,
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
    onMutate: ({ id, input }) => {
      queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ data: MealPlan }>(queryKey);
      // Optimistic update — immediately move the entry to its new slot so
      // drag-and-drop feels instant (no snap-back while waiting for server).
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            entries: old.data.entries
              .map((e) => (e.id === id ? { ...e, ...input } : e))
              .sort(entryOrder),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
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

  // Reorder entries within a single slot. The caller supplies the full new
  // ordering of entry ids for that slot, and we patch the cache optimistically
  // so the drag-and-drop feels instant. On success the server response is the
  // source of truth and replaces the optimistic state.
  const reorderEntries = useMutation({
    mutationFn: (entryIds: number[]) =>
      reorderMealPlanEntries(weekStart, entryIds),
    onMutate: (entryIds) => {
      queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ data: MealPlan }>(queryKey);
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        const positionById = new Map(entryIds.map((id, idx) => [id, idx]));
        return {
          ...old,
          data: {
            ...old.data,
            entries: old.data.entries
              .map((e) =>
                positionById.has(e.id)
                  ? { ...e, position: positionById.get(e.id)! }
                  : e
              )
              .sort(entryOrder),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        const updated = new Map(res.data.map((e: MealPlanEntry) => [e.id, e]));
        return {
          ...old,
          data: {
            ...old.data,
            entries: old.data.entries
              .map((e) => updated.get(e.id) ?? e)
              .sort(entryOrder),
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
    reorderEntries,
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
