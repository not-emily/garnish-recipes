import { useEffect } from "react";
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
import { getConsumer } from "@/lib/cable";
import { useAuth } from "@/contexts/AuthContext";
import { LEFTOVER_TRAY_KEY } from "./useLeftoverTray";

// Broadcast payload shapes from MealPlanChannel.
type Broadcast =
  | { action: "entry_created"; entry: MealPlanEntry; actor_apikey: string }
  | { action: "entry_updated"; entry: MealPlanEntry; actor_apikey: string }
  | { action: "entry_destroyed"; entry_id: number; actor_apikey: string }
  | { action: "entries_reordered"; entries: MealPlanEntry[]; actor_apikey: string }
  // Tray item broadcasts are handled by invalidating the tray query rather
  // than merging into the local entries list.
  | { action: "tray_item_created"; tray_item: unknown; actor_apikey: string }
  | { action: "tray_item_destroyed"; tray_item_id: number; actor_apikey: string };

/**
 * Fetches a meal plan week and exposes mutation helpers that optimistically
 * update the cache. All mutations invalidate on settle so we re-sync with
 * server truth after each change.
 */
export function useMealPlan(weekStart: string) {
  const queryClient = useQueryClient();
  const queryKey = ["mealPlan", weekStart] as const;
  const { user } = useAuth();

  const query = useQuery({
    queryKey,
    queryFn: () => getMealPlan(weekStart),
    // Keep the previous week's data on-screen while the new week loads,
    // so MobileDayView stays mounted during cross-week swipe navigation
    // (avoids unmount → remount → state loss).
    placeholderData: keepPreviousData,
  });

  // Subscribe to MealPlanChannel for real-time sync. Broadcasts from
  // other household members get merged into the TanStack Query cache.
  // Our own broadcasts are filtered out via actor_apikey — we already
  // applied them via optimistic update.
  useEffect(() => {
    if (!user) return;
    const consumer = getConsumer();
    const subscription = consumer.subscriptions.create(
      { channel: "MealPlanChannel", week_start: weekStart },
      {
        received(data: Broadcast) {
          // Ignore our own broadcasts — optimistic update already applied.
          if (data.actor_apikey === user.id) return;

          // Tray broadcasts: just invalidate so the tray refetches. The
          // payload shape is richer than we need here, and the tray is
          // stored in a different query key anyway.
          if (
            data.action === "tray_item_created" ||
            data.action === "tray_item_destroyed"
          ) {
            queryClient.invalidateQueries({ queryKey: LEFTOVER_TRAY_KEY });
            return;
          }

          queryClient.setQueryData(
            queryKey,
            (old: { data: MealPlan } | undefined) => {
              if (!old) return old;
              const entries = applyBroadcast(old.data.entries, data);
              return { ...old, data: { ...old.data, entries } };
            }
          );
        },
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // queryKey is stable across renders for a given weekStart, no need
    // to include it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, user?.id]);

  const createEntry = useMutation({
    mutationFn: (input: CreateEntryInput) =>
      createMealPlanEntry(weekStart, input),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        const newEntries = [res.data, ...(res.leftovers ?? [])];
        return {
          ...old,
          data: {
            ...old.data,
            entries: [...old.data.entries, ...newEntries].sort(entryOrder),
          },
        };
      });
      if (res.tray_items && res.tray_items.length > 0) {
        queryClient.invalidateQueries({ queryKey: LEFTOVER_TRAY_KEY });
      }
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
    mutationFn: ({ id, cascade }: { id: number; cascade?: boolean }) =>
      deleteMealPlanEntry(weekStart, id, { cascade }),
    onSuccess: (_res, { id }) => {
      queryClient.setQueryData(queryKey, (old: { data: MealPlan } | undefined) => {
        if (!old) return old;
        // Filter out the deleted entry + any linked leftover entries (if
        // cascade was used, the server destroyed them too).
        return {
          ...old,
          data: {
            ...old.data,
            entries: old.data.entries.filter(
              (e) => e.id !== id && e.leftover_of_id !== id
            ),
          },
        };
      });
      // Tray items tied to this source may also have been destroyed by
      // cascade. Invalidate the tray query so it refetches.
      queryClient.invalidateQueries({ queryKey: LEFTOVER_TRAY_KEY });
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

// Apply a broadcast from another household member to the local entry list.
function applyBroadcast(entries: MealPlanEntry[], data: Broadcast): MealPlanEntry[] {
  switch (data.action) {
    case "entry_created": {
      // Avoid duplicates if we somehow receive a broadcast for an entry
      // we already have (e.g., our own echo that slipped past the filter).
      if (entries.some((e) => e.id === data.entry.id)) return entries;
      return [...entries, data.entry].sort(entryOrder);
    }
    case "entry_updated": {
      return entries
        .map((e) => (e.id === data.entry.id ? data.entry : e))
        .sort(entryOrder);
    }
    case "entry_destroyed": {
      return entries.filter((e) => e.id !== data.entry_id);
    }
    case "entries_reordered": {
      const updated = new Map(data.entries.map((e) => [e.id, e]));
      return entries.map((e) => updated.get(e.id) ?? e).sort(entryOrder);
    }
  }
}
