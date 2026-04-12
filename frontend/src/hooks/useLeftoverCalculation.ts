// Client-side mirror of LeftoverCalculator (backend/app/services/leftover_calculator.rb).
// Keeping the logic in sync means LeftoverPrompt can render synchronously from
// cached recipe summary data — no roundtrip before we know whether to show it.

export interface LeftoverCalculation {
  calculable: boolean;
  servings: number;
  diners: number;
  meals_count: number;
  remaining_servings: number;
  has_full_leftover_meals: boolean;
  has_partial_leftovers: boolean;
  suggested_leftover_count: number;
}

interface Inputs {
  servings: number | null | undefined;
  default_diners: number;
  servings_override?: number | null;
  diners_override?: number | null;
}

export function calculateLeftovers({
  servings,
  default_diners,
  servings_override,
  diners_override,
}: Inputs): LeftoverCalculation {
  const s = Math.trunc(Number(servings_override ?? servings ?? 0));
  const d = Math.trunc(Number(diners_override ?? default_diners));
  const calculable = s > 0 && d > 0;
  if (!calculable) {
    return {
      calculable: false,
      servings: s,
      diners: d,
      meals_count: 0,
      remaining_servings: 0,
      has_full_leftover_meals: false,
      has_partial_leftovers: false,
      suggested_leftover_count: 0,
    };
  }
  const meals = Math.floor(s / d);
  const remainder = s % d;
  return {
    calculable: true,
    servings: s,
    diners: d,
    meals_count: meals,
    remaining_servings: remainder,
    has_full_leftover_meals: meals > 1,
    has_partial_leftovers: remainder > 0,
    suggested_leftover_count: meals > 1 ? meals - 1 : 0,
  };
}
