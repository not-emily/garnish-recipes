import { useState, type FormEvent } from "react";
import { updateHousehold } from "@/api/households";
import { useHousehold } from "@/contexts/HouseholdContext";
import type { ApiError } from "@/types";

export function HouseholdSettings() {
  const { household, setHousehold } = useHousehold();
  const [name, setName] = useState(household?.name ?? "");
  const [diners, setDiners] = useState(household?.default_diners ?? 2);
  const [leftoverSuggestion, setLeftoverSuggestion] = useState<string>(
    household?.leftover_suggestion ?? "ask"
  );
  const [leftoverSlot, setLeftoverSlot] = useState<string>(
    household?.leftover_default_slot ?? "lunch"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!household || household.my_role !== "owner") return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    setSaved(false);

    try {
      const res = await updateHousehold({
        name,
        default_diners: diners,
        leftover_suggestion: leftoverSuggestion as "on" | "off" | "ask",
        leftover_default_slot: leftoverSlot as
          | "breakfast"
          | "lunch"
          | "dinner"
          | "ask",
      });
      setHousehold(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.error?.message || "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="household-name" className="block text-sm font-medium text-gray-700">
          Household name
        </label>
        <input
          id="household-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      <div>
        <label htmlFor="default-diners" className="block text-sm font-medium text-gray-700">
          Default diners
        </label>
        <input
          id="default-diners"
          type="number"
          required
          min={1}
          max={20}
          value={diners}
          onChange={(e) => setDiners(Number(e.target.value))}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      <div>
        <label htmlFor="leftover-suggestion" className="block text-sm font-medium text-gray-700">
          Suggest leftovers
        </label>
        <select
          id="leftover-suggestion"
          value={leftoverSuggestion}
          onChange={(e) => setLeftoverSuggestion(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        >
          <option value="on">Always suggest</option>
          <option value="off">Never suggest</option>
          <option value="ask">Ask each time</option>
        </select>
      </div>

      <div>
        <label htmlFor="leftover-slot" className="block text-sm font-medium text-gray-700">
          Default leftover slot
        </label>
        <select
          id="leftover-slot"
          value={leftoverSlot}
          onChange={(e) => setLeftoverSlot(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="ask">Ask each time</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-lg bg-garnish-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 focus:outline-none focus:ring-2 focus:ring-garnish-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSaving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
      </button>
    </form>
  );
}
