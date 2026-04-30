import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  parseQuantity,
  replaceFractionalPart,
  unitClass,
} from "./quantity";

describe("parseQuantity", () => {
  describe("integers and decimals", () => {
    it("parses integers", () => {
      expect(parseQuantity("0")).toBe(0);
      expect(parseQuantity("3")).toBe(3);
      expect(parseQuantity("12")).toBe(12);
    });

    it("parses decimals", () => {
      expect(parseQuantity("1.5")).toBe(1.5);
      expect(parseQuantity("0.5")).toBe(0.5);
      expect(parseQuantity(".5")).toBe(0.5);
      expect(parseQuantity("2.625")).toBe(2.625);
    });
  });

  describe("ascii fractions", () => {
    it("parses simple fractions", () => {
      expect(parseQuantity("3/4")).toBe(0.75);
      expect(parseQuantity("1/2")).toBe(0.5);
      expect(parseQuantity("1/8")).toBe(0.125);
    });

    it("tolerates whitespace around the slash", () => {
      expect(parseQuantity("3 / 4")).toBe(0.75);
      expect(parseQuantity("1 /2")).toBe(0.5);
      expect(parseQuantity("1/ 2")).toBe(0.5);
    });

    it("parses mixed fractions with a space", () => {
      expect(parseQuantity("1 3/4")).toBe(1.75);
      expect(parseQuantity("2 1/2")).toBe(2.5);
    });

    it("parses hyphenated mixed fractions (common in scraped recipes)", () => {
      expect(parseQuantity("1-3/4")).toBe(1.75);
      expect(parseQuantity("2-1/2")).toBe(2.5);
    });
  });

  describe("unicode vulgar fractions", () => {
    it("parses standalone glyphs", () => {
      expect(parseQuantity("½")).toBe(0.5);
      expect(parseQuantity("⅓")).toBeCloseTo(1 / 3, 10);
      expect(parseQuantity("⅔")).toBeCloseTo(2 / 3, 10);
      expect(parseQuantity("¼")).toBe(0.25);
      expect(parseQuantity("¾")).toBe(0.75);
      expect(parseQuantity("⅛")).toBe(0.125);
      expect(parseQuantity("⅜")).toBe(0.375);
      expect(parseQuantity("⅝")).toBe(0.625);
      expect(parseQuantity("⅞")).toBe(0.875);
    });

    it("parses integer + glyph (no space)", () => {
      expect(parseQuantity("1¾")).toBe(1.75);
      expect(parseQuantity("2½")).toBe(2.5);
    });

    it("parses integer + space + glyph", () => {
      expect(parseQuantity("1 ¾")).toBe(1.75);
      expect(parseQuantity("2 ½")).toBe(2.5);
    });
  });

  describe("whitespace handling", () => {
    it("trims surrounding whitespace", () => {
      expect(parseQuantity("  3  ")).toBe(3);
      expect(parseQuantity("\t1.5\n")).toBe(1.5);
      expect(parseQuantity("  3 / 4  ")).toBe(0.75);
    });
  });

  describe("invalid input returns null", () => {
    it("rejects empty or whitespace-only", () => {
      expect(parseQuantity("")).toBeNull();
      expect(parseQuantity("   ")).toBeNull();
    });

    it("rejects non-numeric text", () => {
      expect(parseQuantity("abc")).toBeNull();
      expect(parseQuantity("a/b")).toBeNull();
      expect(parseQuantity("1/2 cup")).toBeNull();
    });

    it("rejects divide-by-zero", () => {
      expect(parseQuantity("1/0")).toBeNull();
      expect(parseQuantity("0/0")).toBeNull();
      expect(parseQuantity("1 1/0")).toBeNull();
    });

    it("rejects pathological forms", () => {
      expect(parseQuantity("1//2")).toBeNull();
      expect(parseQuantity("//")).toBeNull();
      expect(parseQuantity("1/")).toBeNull();
      expect(parseQuantity("/2")).toBeNull();
      expect(parseQuantity("1.2.3")).toBeNull();
      expect(parseQuantity("1.")).toBeNull();
      expect(parseQuantity("½½")).toBeNull();
      expect(parseQuantity("¾ ¾")).toBeNull();
    });

    it("rejects negative numbers (recipes don't have negative quantities)", () => {
      expect(parseQuantity("-1")).toBeNull();
      expect(parseQuantity("-1.5")).toBeNull();
    });
  });
});

describe("unitClass", () => {
  it("classifies decimal-class units", () => {
    for (const u of ["g", "kg", "oz", "lb", "lbs", "ml", "l"]) {
      expect(unitClass(u)).toBe("decimal");
    }
  });

  it("classifies long-form decimal units", () => {
    for (const u of [
      "gram", "grams",
      "kilogram", "kilograms",
      "ounce", "ounces",
      "pound", "pounds",
      "milliliter", "milliliters", "millilitre", "millilitres",
      "liter", "liters", "litre", "litres",
    ]) {
      expect(unitClass(u)).toBe("decimal");
    }
  });

  it("classifies fractional-class units", () => {
    for (const u of [
      "cup", "tsp", "tbsp", "clove", "cloves",
      "can", "cans", "pinch", "dash", "package",
    ]) {
      expect(unitClass(u)).toBe("fractional");
    }
  });

  it("defaults empty/null/undefined to fractional", () => {
    expect(unitClass(null)).toBe("fractional");
    expect(unitClass(undefined)).toBe("fractional");
    expect(unitClass("")).toBe("fractional");
  });

  it("defaults unknown units to fractional", () => {
    expect(unitClass("bunch")).toBe("fractional");
    expect(unitClass("head")).toBe("fractional");
    expect(unitClass("slice")).toBe("fractional");
  });

  it("is case-insensitive", () => {
    expect(unitClass("CUP")).toBe("fractional");
    expect(unitClass("Cup")).toBe("fractional");
    expect(unitClass("LB")).toBe("decimal");
    expect(unitClass("Kg")).toBe("decimal");
  });

  it("trims surrounding whitespace", () => {
    expect(unitClass(" lb ")).toBe("decimal");
    expect(unitClass("\tcup\n")).toBe("fractional");
  });
});

describe("formatQuantity", () => {
  describe("fractional units snap to clean fractions", () => {
    it("renders simple fractions as unicode glyphs", () => {
      expect(formatQuantity(0.5, "cup")).toBe("½");
      expect(formatQuantity(0.25, "cup")).toBe("¼");
      expect(formatQuantity(0.75, "cup")).toBe("¾");
      expect(formatQuantity(0.125, "cup")).toBe("⅛");
    });

    it("renders thirds with snap tolerance", () => {
      expect(formatQuantity(1 / 3, "cup")).toBe("⅓");
      expect(formatQuantity(2 / 3, "cup")).toBe("⅔");
      expect(formatQuantity(0.333, "cup")).toBe("⅓");
      expect(formatQuantity(0.667, "cup")).toBe("⅔");
    });

    it("renders eighths", () => {
      expect(formatQuantity(0.375, "cup")).toBe("⅜");
      expect(formatQuantity(0.625, "cup")).toBe("⅝");
      expect(formatQuantity(0.875, "cup")).toBe("⅞");
    });

    it("renders mixed numbers (integer + fraction)", () => {
      expect(formatQuantity(1.5, "cup")).toBe("1½");
      expect(formatQuantity(1.75, "cup")).toBe("1¾");
      expect(formatQuantity(2.625, "cup")).toBe("2⅝");
      expect(formatQuantity(3.5, "tsp")).toBe("3½");
    });

    it("prefers smallest denominator (1/2 over 2/4 or 4/8)", () => {
      expect(formatQuantity(0.5, "cup")).toBe("½");
      expect(formatQuantity(0.25, "cup")).toBe("¼");
    });

    it("renders whole numbers without a fraction", () => {
      expect(formatQuantity(1, "cup")).toBe("1");
      expect(formatQuantity(3, "cup")).toBe("3");
      expect(formatQuantity(0, "cup")).toBe("0");
    });

    it("snaps near-whole values to the integer when ≥ 1", () => {
      expect(formatQuantity(0.99, "cup")).toBe("1");
      expect(formatQuantity(1.01, "cup")).toBe("1");
      expect(formatQuantity(1.99, "cup")).toBe("2");
    });

    it("does not snap tiny values to 0 (preserves user input)", () => {
      expect(formatQuantity(0.01, "cup")).toBe("0.01");
      expect(formatQuantity(0.05, "cup")).toBe("0.05");
    });
  });

  describe("snap tolerance edges", () => {
    it("snaps values within tolerance to the nearest fraction", () => {
      expect(formatQuantity(0.26, "cup")).toBe("¼");
      expect(formatQuantity(0.51, "cup")).toBe("½");
      expect(formatQuantity(0.74, "cup")).toBe("¾");
    });

    it("falls back to decimal outside tolerance", () => {
      expect(formatQuantity(0.27, "cup")).toBe("0.27");
      expect(formatQuantity(0.4, "cup")).toBe("0.4");
      expect(formatQuantity(0.1, "cup")).toBe("0.1");
    });
  });

  describe("decimal units render as decimal", () => {
    it("renders weight units as decimal", () => {
      expect(formatQuantity(1.5, "lb")).toBe("1.5");
      expect(formatQuantity(355, "g")).toBe("355");
      expect(formatQuantity(2.5, "kg")).toBe("2.5");
      expect(formatQuantity(8, "oz")).toBe("8");
    });

    it("renders volume-by-mass units as decimal", () => {
      expect(formatQuantity(250, "ml")).toBe("250");
      expect(formatQuantity(1.5, "l")).toBe("1.5");
    });

    it("does not snap weight units to fractions", () => {
      expect(formatQuantity(1.5, "lb")).toBe("1.5");
      expect(formatQuantity(0.5, "g")).toBe("0.5");
      expect(formatQuantity(0.333, "kg")).toBe("0.33");
    });

    it("trims trailing zeros and dots", () => {
      expect(formatQuantity(1.0, "lb")).toBe("1");
      expect(formatQuantity(1.5, "lb")).toBe("1.5");
      expect(formatQuantity(1.50, "lb")).toBe("1.5");
      expect(formatQuantity(1.123, "lb")).toBe("1.12");
    });
  });

  describe("no unit defaults to fractional", () => {
    it("renders fractions when unit is missing", () => {
      expect(formatQuantity(0.5)).toBe("½");
      expect(formatQuantity(1.75, null)).toBe("1¾");
      expect(formatQuantity(3, undefined)).toBe("3");
    });
  });

  describe("null/undefined/invalid input returns empty string", () => {
    it("returns empty for null and undefined", () => {
      expect(formatQuantity(null, "cup")).toBe("");
      expect(formatQuantity(undefined, "cup")).toBe("");
    });

    it("returns empty for non-finite numbers", () => {
      expect(formatQuantity(Infinity, "cup")).toBe("");
      expect(formatQuantity(NaN, "cup")).toBe("");
    });

    it("returns empty for negative numbers", () => {
      expect(formatQuantity(-1, "cup")).toBe("");
      expect(formatQuantity(-0.5, "lb")).toBe("");
    });
  });

  describe("round-trip through parser", () => {
    it("user-typed fractions round-trip through display", () => {
      const cases = ["1 3/4", "3/4", "1/2", "1/3", "2/3", "5/8", "1¾", "½"];
      for (const input of cases) {
        const parsed = parseQuantity(input);
        expect(parsed).not.toBeNull();
        const displayed = formatQuantity(parsed, "cup");
        // Re-parse the displayed form — should give the same number back
        const reParsed = parseQuantity(displayed);
        expect(reParsed).toBeCloseTo(parsed!, 10);
      }
    });

    it("decimals on weight units round-trip", () => {
      const parsed = parseQuantity("1.5");
      expect(formatQuantity(parsed, "lb")).toBe("1.5");
    });
  });
});

describe("replaceFractionalPart", () => {
  it("inserts a chip into an empty string", () => {
    expect(replaceFractionalPart("", "¾")).toBe("¾");
  });

  it("appends a chip to a bare integer", () => {
    expect(replaceFractionalPart("1", "¾")).toBe("1¾");
    expect(replaceFractionalPart("12", "½")).toBe("12½");
  });

  it("replaces an existing unicode fraction", () => {
    expect(replaceFractionalPart("1¾", "½")).toBe("1½");
    expect(replaceFractionalPart("2⅓", "¼")).toBe("2¼");
  });

  it("replaces an existing decimal portion", () => {
    expect(replaceFractionalPart("1.5", "⅓")).toBe("1⅓");
    expect(replaceFractionalPart("12.625", "¾")).toBe("12¾");
  });

  it("replaces an existing ascii fraction", () => {
    expect(replaceFractionalPart("1 3/4", "½")).toBe("1½");
    expect(replaceFractionalPart("1-3/4", "½")).toBe("1½");
  });

  it("treats leading 0 as empty (drops the zero)", () => {
    expect(replaceFractionalPart("0", "¾")).toBe("¾");
    expect(replaceFractionalPart("0.5", "¾")).toBe("¾");
  });

  it("returns the chip alone when input has no integer prefix", () => {
    expect(replaceFractionalPart("¾", "½")).toBe("½");
    expect(replaceFractionalPart(".5", "¼")).toBe("¼");
  });

  it("trims surrounding whitespace", () => {
    expect(replaceFractionalPart("  1  ", "¾")).toBe("1¾");
  });
});
