import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { createMealPlanEntry } from "@/api/mealPlans";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/components/ui/Toast";
import { calculateLeftovers } from "@/hooks/useLeftoverCalculation";
import { LeftoverPrompt } from "./LeftoverPrompt";
import { MEAL_SLOTS } from "@/types/mealPlan";
import type { MealSlot } from "@/types/mealPlan";
import {
  weekStartOf,
  weekDays,
  addDays,
  addWeeks,
  todayIso,
  formatWeekRange,
  formatWeekdayShort,
  formatMonthDay,
  formatWeekdayLong,
  isSameDay,
} from "@/lib/weekUtils";

interface AddToMealPlanModalProps {
  open: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  recipeServings?: number | null;
}

export function AddToMealPlanModal({
  open,
  onClose,
  recipeId,
  recipeTitle,
  recipeServings,
}: AddToMealPlanModalProps) {
  const queryClient = useQueryClient();
  const { household } = useHousehold();
  const { toast } = useToast();

  const today = todayIso();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("dinner");
  const [showLeftoverPrompt, setShowLeftoverPrompt] = useState(false);

  const isThisWeek = useMemo(() => weekStart === weekStartOf(today), [weekStart, today]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      const t = todayIso();
      setWeekStart(weekStartOf(t));
      setSelectedDate(t);
      setSelectedSlot("dinner");
      setShowLeftoverPrompt(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (opts?: {
      leftovers?: { date: string; meal_slot: MealSlot }[];
      trackRemaining?: boolean;
    }) =>
      createMealPlanEntry(weekStartOf(selectedDate), {
        recipe_id: recipeId,
        date: selectedDate,
        meal_slot: selectedSlot,
        leftovers: opts?.leftovers,
        track_remaining: opts?.trackRemaining,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
      toast(`Added to ${selectedSlot} on ${formatWeekdayLong(selectedDate)}, ${formatMonthDay(selectedDate)}`);
      onClose();
    },
  });

  function handleAdd() {
    // Check for leftovers before submitting
    if (household && household.leftover_suggestion !== "off" && recipeServings) {
      const calc = calculateLeftovers({
        servings: recipeServings,
        default_diners: household.default_diners,
      });
      if (calc.has_full_leftover_meals) {
        setShowLeftoverPrompt(true);
        return;
      }
      if (calc.has_partial_leftovers) {
        mutation.mutate({ trackRemaining: true });
        return;
      }
    }
    mutation.mutate();
  }

  function handleLeftoverConfirm(
    leftovers: { date: string; meal_slot: MealSlot }[],
    trackRemaining: boolean
  ) {
    mutation.mutate({ leftovers, trackRemaining });
  }

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40 transition-opacity"
      />
      <div className="relative flex w-full max-w-md max-h-[85vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Add to Meal Plan</h2>
            <p className="mt-0.5 truncate text-xs text-gray-500">{recipeTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showLeftoverPrompt && household ? (
          <div className="flex-1 overflow-y-auto p-5">
            <LeftoverPrompt
              recipe={{ id: recipeId, title: recipeTitle, servings: recipeServings ?? null } as any}
              target={{ date: selectedDate, slot: selectedSlot }}
              household={household}
              onConfirm={handleLeftoverConfirm}
              onBack={() => setShowLeftoverPrompt(false)}
              isSubmitting={mutation.isPending}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const prev = addWeeks(weekStart, -1);
                  setWeekStart(prev);
                  setSelectedDate(addDays(prev, 6));
                }}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {formatWeekRange(weekStart)}
                </span>
                {!isThisWeek && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = todayIso();
                      setWeekStart(weekStartOf(t));
                      setSelectedDate(t);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-garnish-600 hover:bg-garnish-50"
                  >
                    <CalendarDays className="h-3 w-3" />
                    Today
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = addWeeks(weekStart, 1);
                  setWeekStart(next);
                  setSelectedDate(next);
                }}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Date grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDate);
                const dayNum = day.split("-")[2]?.replace(/^0/, "");
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-center transition-colors ${
                      isSelected
                        ? "bg-garnish-600 text-white"
                        : isToday
                          ? "bg-garnish-50 text-garnish-700"
                          : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-[10px] font-medium uppercase">
                      {formatWeekdayShort(day)}
                    </span>
                    <span className="text-sm font-semibold">{dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* Slot picker */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Meal
              </h3>
              <div className="flex gap-2">
                {MEAL_SLOTS.map((slot) => (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => setSelectedSlot(slot.value)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      selectedSlot === slot.value
                        ? "bg-garnish-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add button */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={mutation.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
