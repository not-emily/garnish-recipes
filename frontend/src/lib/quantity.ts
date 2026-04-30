// Quantity parsing and formatting for recipe ingredients and grocery items.
//
// Storage stays decimal: every ingredient/grocery quantity is a `number` in
// JSONB on the backend. Display routes through `formatQuantity` and uses
// fractions for cup/tsp/tbsp-style units, decimals for g/kg/lb/ml-style units.
// Input routes through `parseQuantity` which accepts integers, decimals, ascii
// fractions ("3/4", "1 3/4", "1-3/4"), and unicode vulgar fractions ("¾", "1¾").
//
// The test suite in quantity.test.ts is the canonical spec. When the
// imported-recipe-parsing backlog item is picked up, port the same algorithm
// to Ruby and reuse the test cases.

const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const VULGAR_FRACTION_CLASS = "[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅞⅝]";

const RE_UNICODE_ALONE = new RegExp(`^${VULGAR_FRACTION_CLASS}$`);
const RE_INT_THEN_UNICODE = new RegExp(`^(\\d+)\\s*(${VULGAR_FRACTION_CLASS})$`);
const RE_MIXED_ASCII = /^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/;
const RE_ASCII_FRACTION = /^(\d+)\s*\/\s*(\d+)$/;
const RE_NUMERIC = /^\d*\.\d+$|^\d+$/;

/**
 * Parse a user- or scraper-produced quantity string into a decimal number.
 * Returns null for invalid input (including empty string, NaN-producing
 * forms, and divide-by-zero).
 */
export function parseQuantity(text: string): number | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;

  if (RE_UNICODE_ALONE.test(trimmed)) {
    return VULGAR_FRACTIONS[trimmed];
  }

  const intUnicode = RE_INT_THEN_UNICODE.exec(trimmed);
  if (intUnicode) {
    return Number(intUnicode[1]) + VULGAR_FRACTIONS[intUnicode[2]];
  }

  const mixed = RE_MIXED_ASCII.exec(trimmed);
  if (mixed) {
    const denom = Number(mixed[3]);
    if (denom === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denom;
  }

  const fraction = RE_ASCII_FRACTION.exec(trimmed);
  if (fraction) {
    const denom = Number(fraction[2]);
    if (denom === 0) return null;
    return Number(fraction[1]) / denom;
  }

  if (RE_NUMERIC.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

// Decimal-class units use scale-style decimal display. Anything else
// (cup, tsp, tbsp, clove, can, no unit, unknown) defaults to fractional.
const DECIMAL_UNITS = new Set([
  "g", "gram", "grams",
  "kg", "kilogram", "kilograms",
  "oz", "ounce", "ounces",
  "lb", "lbs", "pound", "pounds",
  "ml", "milliliter", "milliliters", "millilitre", "millilitres",
  "l", "liter", "liters", "litre", "litres",
]);

export type UnitClass = "fractional" | "decimal";

export function unitClass(unit: string | null | undefined): UnitClass {
  if (!unit) return "fractional";
  return DECIMAL_UNITS.has(unit.trim().toLowerCase()) ? "decimal" : "fractional";
}

const SNAP_TOLERANCE = 0.02;

// Smallest denominator first so 0.5 → "½" rather than "4/8".
const FRACTIONAL_DENOMINATORS = [2, 3, 4, 8];

const SNAP_GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

/**
 * Format a decimal quantity for display. Routes by unit class.
 * Empty string for null/undefined/non-finite/negative input.
 */
export function formatQuantity(
  value: number | null | undefined,
  unit?: string | null,
): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "";
  if (unitClass(unit) === "decimal") {
    return formatDecimal(value);
  }
  return formatFractional(value);
}

function formatDecimal(value: number): string {
  // Round to 2 places, trim trailing zeros and a trailing dot.
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, "") || "0";
}

// Strip any existing fractional/decimal portion of a quantity string and
// append the given fraction glyph, preserving the integer prefix. Used by
// the fraction chip row to insert a glyph into the quantity input.
//   ""      + ¾ → "¾"
//   "1"     + ¾ → "1¾"
//   "1¾"    + ½ → "1½"
//   "1.5"   + ⅓ → "1⅓"
//   "1 3/4" + ½ → "1½"
//   "0.5"   + ¾ → "¾"  (treats leading 0 as empty)
export function replaceFractionalPart(value: string, chip: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return chip;
  const match = /^(\d+)/.exec(trimmed);
  if (!match) return chip;
  const intValue = Number(match[1]);
  if (intValue === 0) return chip;
  return `${intValue}${chip}`;
}

function formatFractional(value: number): string {
  // Whole-number snap, but only when rounding to ≥ 1 — otherwise tiny values
  // like 0.01 would silently render as "0".
  const rounded = Math.round(value);
  if (rounded >= 1 && Math.abs(value - rounded) < SNAP_TOLERANCE) {
    return String(rounded);
  }

  const whole = Math.floor(value);
  const remainder = value - whole;

  for (const denom of FRACTIONAL_DENOMINATORS) {
    const num = Math.round(remainder * denom);
    if (num <= 0 || num >= denom) continue;
    if (Math.abs(remainder - num / denom) >= SNAP_TOLERANCE) continue;
    const key = `${num}/${denom}`;
    const glyph = SNAP_GLYPHS[key];
    if (glyph) {
      return whole === 0 ? glyph : `${whole}${glyph}`;
    }
  }

  return formatDecimal(value);
}
