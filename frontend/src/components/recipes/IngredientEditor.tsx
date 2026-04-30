import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, X } from "lucide-react";
import { COMMON_UNITS } from "@/types/recipe";
import type { IngredientGroup, Ingredient } from "@/types/recipe";
import { formatQuantity, parseQuantity, unitClass } from "@/lib/quantity";
import { FractionChipRow } from "./FractionChipRow";

interface IngredientEditorProps {
  groups: IngredientGroup[];
  onChange: (groups: IngredientGroup[]) => void;
}

export function IngredientEditor({ groups, onChange }: IngredientEditorProps) {
  // Ensure there is at least one group
  const safeGroups = groups.length > 0 ? groups : [{ ingredients: [] }];

  function updateGroup(gi: number, patch: Partial<IngredientGroup>) {
    onChange(safeGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }

  function deleteGroup(gi: number) {
    if (safeGroups.length === 1) {
      // Don't delete the last group, just clear its ingredients
      onChange([{ ingredients: [] }]);
      return;
    }
    onChange(safeGroups.filter((_, i) => i !== gi));
  }

  function addGroup() {
    onChange([...safeGroups, { label: "", ingredients: [] }]);
  }

  function addIngredient(gi: number) {
    const group = safeGroups[gi];
    updateGroup(gi, {
      ingredients: [...group.ingredients, { name: "" }],
    });
  }

  function updateIngredient(gi: number, ii: number, patch: Partial<Ingredient>) {
    const group = safeGroups[gi];
    updateGroup(gi, {
      ingredients: group.ingredients.map((ing, i) =>
        i === ii ? { ...ing, ...patch } : ing
      ),
    });
  }

  function deleteIngredient(gi: number, ii: number) {
    const group = safeGroups[gi];
    updateGroup(gi, {
      ingredients: group.ingredients.filter((_, i) => i !== ii),
    });
  }

  function moveIngredient(gi: number, ii: number, direction: -1 | 1) {
    const group = safeGroups[gi];
    const target = ii + direction;
    if (target < 0 || target >= group.ingredients.length) return;
    const next = [...group.ingredients];
    [next[ii], next[target]] = [next[target], next[ii]];
    updateGroup(gi, { ingredients: next });
  }

  return (
    <div className="space-y-4">
      {safeGroups.map((group, gi) => (
        <div
          key={gi}
          className="rounded-lg border border-gray-200 p-3"
        >
          {/* Section header (only show when there are multiple groups or a label exists) */}
          {(safeGroups.length > 1 || group.label !== undefined) && (
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                value={group.label ?? ""}
                onChange={(e) => updateGroup(gi, { label: e.target.value })}
                placeholder='Section label (e.g., "For the sauce")'
                className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
              />
              <button
                type="button"
                onClick={() => deleteGroup(gi)}
                className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                aria-label="Delete section"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Ingredient rows */}
          <div className="space-y-2">
            {group.ingredients.map((ing, ii) => (
              <IngredientRow
                key={ii}
                ing={ing}
                gi={gi}
                ii={ii}
                isFirst={ii === 0}
                isLast={ii === group.ingredients.length - 1}
                onUpdate={(patch) => updateIngredient(gi, ii, patch)}
                onDelete={() => deleteIngredient(gi, ii)}
                onMove={(direction) => moveIngredient(gi, ii, direction)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addIngredient(gi)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-garnish-600 hover:text-garnish-700"
          >
            <Plus className="h-3 w-3" />
            Add ingredient
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        <Plus className="h-3 w-3" />
        Add section
      </button>
    </div>
  );
}

interface IngredientRowProps {
  ing: Ingredient;
  gi: number;
  ii: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<Ingredient>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}

function IngredientRow({
  ing,
  gi,
  ii,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: IngredientRowProps) {
  // Local string state for the qty input. Initialized from props at mount;
  // user owns the in-progress text after that. Committed back to the parent
  // (as a parsed number) on blur. Truly unparseable input reverts to the last
  // good value — the bounce-back is the feedback.
  const [qtyText, setQtyText] = useState(
    ing.quantity != null ? formatQuantity(ing.quantity, ing.unit) : "",
  );
  const [qtyFocused, setQtyFocused] = useState(false);

  function handleQtyBlur() {
    setQtyFocused(false);
    const trimmed = qtyText.trim();
    if (trimmed === "") {
      onUpdate({ quantity: null });
      return;
    }
    const parsed = parseQuantity(trimmed);
    if (parsed === null) {
      setQtyText(ing.quantity != null ? formatQuantity(ing.quantity, ing.unit) : "");
      return;
    }
    onUpdate({ quantity: parsed });
  }

  const qtyClasses =
    "col-span-2 rounded-md border border-gray-200 px-1.5 py-1 text-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500";

  return (
    <div className="flex items-start gap-1.5">
      {/* Reorder buttons */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="rounded-sm p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          className="rounded-sm p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="grid flex-1 grid-cols-12 gap-1.5">
        {/* Quantity */}
        <input
          type="text"
          inputMode="text"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
          onFocus={() => setQtyFocused(true)}
          onBlur={handleQtyBlur}
          placeholder="Qty"
          className={qtyClasses}
        />

        {/* Unit */}
        <input
          type="text"
          list={`units-${gi}-${ii}`}
          value={ing.unit ?? ""}
          onChange={(e) =>
            onUpdate({ unit: e.target.value || null })
          }
          placeholder="unit"
          className="col-span-3 rounded-md border border-gray-200 px-1.5 py-1 text-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        <datalist id={`units-${gi}-${ii}`}>
          {COMMON_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        {/* Name */}
        <input
          type="text"
          value={ing.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="ingredient"
          className="col-span-7 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />

        {/* Fraction chip row — visible only while editing a fractional-unit qty */}
        <FractionChipRow
          value={qtyText}
          onChipTap={setQtyText}
          visible={qtyFocused && unitClass(ing.unit) === "fractional"}
          className="col-span-12"
        />

        {/* Preparation (full width on next line) */}
        <input
          type="text"
          value={ing.preparation ?? ""}
          onChange={(e) =>
            onUpdate({ preparation: e.target.value || null })
          }
          placeholder="preparation (optional, e.g. diced)"
          className="col-span-12 rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-xs text-gray-600 focus:border-garnish-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-300"
        />
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
        aria-label="Remove ingredient"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
