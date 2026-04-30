// Focus-triggered fraction chip row. Tapping a chip replaces the fractional
// portion of the current value while preserving the integer prefix. The
// caller decides visibility — typically `focused && unitClass(unit) === "fractional"`.
//
// onMouseDown preventDefault is critical: without it, mousedown blurs the
// input, the chip row hides (visible flips false), and the click event never
// fires. This is a known quirk of focus-gated UI.

import { replaceFractionalPart } from "@/lib/quantity";

const CHIPS = ["½", "⅓", "¼", "⅔", "¾", "⅛", "⅜", "⅝"] as const;

export interface FractionChipRowProps {
  value: string;
  onChipTap: (next: string) => void;
  visible: boolean;
  className?: string;
}

export function FractionChipRow({
  value,
  onChipTap,
  visible,
  className,
}: FractionChipRowProps) {
  if (!visible) return null;
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className ?? ""}`}>
      {CHIPS.map((chip) => (
        <button
          type="button"
          key={chip}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChipTap(replaceFractionalPart(value, chip))}
          className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
          aria-label={`Insert ${chip}`}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
