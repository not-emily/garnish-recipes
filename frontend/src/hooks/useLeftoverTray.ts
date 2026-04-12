import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listLeftoverTray,
  deleteLeftoverTrayItem,
  scheduleLeftoverTrayItem,
  type LeftoverTrayItem,
} from "@/api/leftoverTray";
import type { MealSlot } from "@/types/mealPlan";

export const LEFTOVER_TRAY_KEY = [ "leftoverTray" ] as const;

/**
 * Exposes the leftover tray and mutation helpers. Real-time sync piggybacks
 * on useMealPlan's existing channel subscription — when tray_item_created or
 * tray_item_destroyed broadcasts arrive for the currently-viewed week, that
 * hook invalidates this query so the tray refetches. For tray items created
 * via other weeks or tabs, we also refetch on window focus (TanStack default).
 */
export function useLeftoverTray() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LEFTOVER_TRAY_KEY,
    queryFn: listLeftoverTray,
  });

  const removeItem = useMutation({
    mutationFn: (id: number) => deleteLeftoverTrayItem(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<{ data: LeftoverTrayItem[] }>(
        LEFTOVER_TRAY_KEY,
        (old) => (old ? { ...old, data: old.data.filter((i) => i.id !== id) } : old)
      );
    },
  });

  const scheduleItem = useMutation({
    mutationFn: ({
      id,
      date,
      meal_slot,
    }: {
      id: number;
      date: string;
      meal_slot: MealSlot;
    }) => scheduleLeftoverTrayItem(id, { date, meal_slot }),
    onSuccess: (_res, vars) => {
      queryClient.setQueryData<{ data: LeftoverTrayItem[] }>(
        LEFTOVER_TRAY_KEY,
        (old) =>
          old ? { ...old, data: old.data.filter((i) => i.id !== vars.id) } : old
      );
      // The new entry belongs to whatever week the user scheduled it into.
      // Invalidate meal plan queries so the grid refetches.
      queryClient.invalidateQueries({ queryKey: [ "mealPlan" ] });
    },
  });

  return {
    items: query.data?.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    removeItem,
    scheduleItem,
  };
}
