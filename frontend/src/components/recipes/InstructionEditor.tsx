import { ChevronUp, ChevronDown, Trash2, Plus, Timer } from "lucide-react";
import type { InstructionStep } from "@/types/recipe";

interface InstructionEditorProps {
  steps: InstructionStep[];
  onChange: (steps: InstructionStep[]) => void;
}

export function InstructionEditor({ steps, onChange }: InstructionEditorProps) {
  function addStep() {
    onChange([...steps, { step: steps.length + 1, text: "" }]);
  }

  function updateStep(i: number, patch: Partial<InstructionStep>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function deleteStep(i: number) {
    const next = steps
      .filter((_, idx) => idx !== i)
      .map((s, idx) => ({ ...s, step: idx + 1 }));
    onChange(next);
  }

  function moveStep(i: number, direction: -1 | 1) {
    const target = i + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next.map((s, idx) => ({ ...s, step: idx + 1 })));
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div
          key={i}
          className="flex gap-2 rounded-lg border border-gray-200 p-2"
        >
          {/* Step number + reorder */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-garnish-100 text-xs font-semibold text-garnish-700">
              {i + 1}
            </span>
            <button
              type="button"
              onClick={() => moveStep(i, -1)}
              disabled={i === 0}
              className="rounded-sm p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
              aria-label="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => moveStep(i, 1)}
              disabled={i === steps.length - 1}
              className="rounded-sm p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
              aria-label="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 space-y-1.5">
            <textarea
              value={step.text}
              onChange={(e) => updateStep(i, { text: e.target.value })}
              placeholder="Describe this step..."
              rows={2}
              className="block w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3 text-gray-400" />
              <input
                type="number"
                min={0}
                value={step.timer_minutes ?? ""}
                onChange={(e) =>
                  updateStep(i, {
                    timer_minutes: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="Timer (optional)"
                className="w-32 rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs focus:border-garnish-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-300"
              />
              <span className="text-xs text-gray-400">min</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => deleteStep(i)}
            className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Remove step"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="inline-flex items-center gap-1 text-xs font-medium text-garnish-600 hover:text-garnish-700"
      >
        <Plus className="h-3 w-3" />
        Add step
      </button>
    </div>
  );
}
