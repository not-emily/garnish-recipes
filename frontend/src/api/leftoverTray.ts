import { api } from "./client";
import type { MealPlanEntry, MealSlot } from "@/types/mealPlan";

export interface LeftoverTrayItem {
  id: number;
  servings: number;
  created_at: string;
  source_entry_id: number;
  source: {
    recipe_id: string | null;
    title: string;
    image_url: string | null;
  };
}

export function listLeftoverTray() {
  return api<{ data: LeftoverTrayItem[] }>("/leftover_tray");
}

export function deleteLeftoverTrayItem(id: number) {
  return api<void>(`/leftover_tray/${id}`, { method: "DELETE" });
}

export function scheduleLeftoverTrayItem(
  id: number,
  input: { date: string; meal_slot: MealSlot }
) {
  return api<{ data: MealPlanEntry }>(`/leftover_tray/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
