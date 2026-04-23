import { useState, type FormEvent } from "react";
import { X, Plus } from "lucide-react";
import { updateHousehold } from "@/api/households";
import { useHousehold } from "@/contexts/HouseholdContext";
import { isApiError } from "@/api/client";

export function HouseholdSettings() {
  const { household, setHousehold } = useHousehold();
  const [name, setName] = useState(household?.name ?? "");
  const [diners, setDiners] = useState(String(household?.default_diners ?? 2));
  const [leftoverSuggestion, setLeftoverSuggestion] = useState<string>(
    household?.leftover_suggestion ?? "ask"
  );
  const [leftoverSlot, setLeftoverSlot] = useState<string>(
    household?.leftover_default_slot ?? "lunch"
  );
  const [leftoverExpiryDays, setLeftoverExpiryDays] = useState(
    String(household?.leftover_expiry_days ?? 3)
  );
  const [stores, setStores] = useState<string[]>(household?.stores ?? []);
  const [newStore, setNewStore] = useState("");
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
        default_diners: Number(diners),
        leftover_suggestion: leftoverSuggestion as "on" | "off" | "ask",
        leftover_default_slot: leftoverSlot as
          | "breakfast"
          | "lunch"
          | "dinner"
          | "ask",
        leftover_expiry_days: Number(leftoverExpiryDays),
        stores,
      });
      setHousehold(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
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
          onChange={(e) => setDiners(e.target.value)}
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

      <div>
        <label htmlFor="leftover-expiry-days" className="block text-sm font-medium text-gray-700">
          Leftover tray expiry (days)
        </label>
        <input
          id="leftover-expiry-days"
          type="number"
          required
          min={1}
          max={14}
          value={leftoverExpiryDays}
          onChange={(e) => setLeftoverExpiryDays(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Tray items disappear from view after this many days so the tray doesn't clutter up.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Grocery stores
        </label>
        <p className="mt-0.5 text-xs text-gray-500">
          Add stores to tag grocery items by where you buy them.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {stores.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
            >
              {s}
              <button
                type="button"
                onClick={() => setStores(stores.filter((x) => x !== s))}
                className="rounded-full p-0.5 text-gray-400 hover:text-gray-600"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
            placeholder="e.g. Costco, Trader Joe's"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const trimmed = newStore.trim();
                if (trimmed && !stores.includes(trimmed)) {
                  setStores([...stores, trimmed]);
                  setNewStore("");
                }
              }
            }}
            className="block flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = newStore.trim();
              if (trimmed && !stores.includes(trimmed)) {
                setStores([...stores, trimmed]);
                setNewStore("");
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
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
