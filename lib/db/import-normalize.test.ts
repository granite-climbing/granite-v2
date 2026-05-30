import { describe, expect, it } from "vitest";
import {
  normalizeSlug,
  buildId,
  parseBooleanCell,
  parseGradeNum,
  parseHashtagsJson,
} from "./import-normalize";

describe("normalizeSlug", () => {
  it("lowercases and replaces spaces with underscores", () => {
    expect(normalizeSlug("Bacon Dyno")).toBe("bacon_dyno");
  });

  it("collapses multiple spaces into a single underscore", () => {
    expect(normalizeSlug("  Fat   Cat ")).toBe("fat_cat");
  });

  it("preserves numeric-leading slugs", () => {
    expect(normalizeSlug("3m")).toBe("3m");
  });

  it("leaves already-snake-cased strings unchanged", () => {
    expect(normalizeSlug("already_snake")).toBe("already_snake");
  });

  it("strips leading and trailing underscores", () => {
    expect(normalizeSlug("_hello_world_")).toBe("hello_world");
  });

  it("converts non-alphanumeric chars to underscore and collapses", () => {
    expect(normalizeSlug("hello--world")).toBe("hello_world");
  });

  it("handles mixed whitespace and special chars", () => {
    expect(normalizeSlug("Rock & Roll!")).toBe("rock_roll");
  });
});

describe("buildId", () => {
  it("joins prefix and slug with an underscore", () => {
    expect(buildId("route", "anaconda")).toBe("route_anaconda");
  });

  it("works with numeric-leading slugs", () => {
    expect(buildId("route", "3m")).toBe("route_3m");
  });

  it("works with crag prefix", () => {
    expect(buildId("crag", "moraksan")).toBe("crag_moraksan");
  });
});

describe("parseBooleanCell", () => {
  it("returns true for boolean true", () => {
    expect(parseBooleanCell(true)).toBe(true);
  });

  it("returns true for number 1", () => {
    expect(parseBooleanCell(1)).toBe(true);
  });

  it("returns true for string 'true' (case-insensitive)", () => {
    expect(parseBooleanCell("true")).toBe(true);
    expect(parseBooleanCell("True")).toBe(true);
    expect(parseBooleanCell("TRUE")).toBe(true);
  });

  it("returns true for string '1'", () => {
    expect(parseBooleanCell("1")).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(parseBooleanCell(false)).toBe(false);
  });

  it("returns false for number 0", () => {
    expect(parseBooleanCell(0)).toBe(false);
  });

  it("returns false for string 'false' (case-insensitive)", () => {
    expect(parseBooleanCell("false")).toBe(false);
    expect(parseBooleanCell("False")).toBe(false);
    expect(parseBooleanCell("FALSE")).toBe(false);
  });

  it("returns false for string '0'", () => {
    expect(parseBooleanCell("0")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(parseBooleanCell("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(parseBooleanCell(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(parseBooleanCell(undefined)).toBe(false);
  });

  it("returns false for unrecognized values", () => {
    expect(parseBooleanCell("yes")).toBe(false);
    expect(parseBooleanCell(42)).toBe(false);
  });
});

describe("parseGradeNum", () => {
  it("parses V0 to 0", () => {
    expect(parseGradeNum("V0")).toBe(0);
  });

  it("parses V10 to 10", () => {
    expect(parseGradeNum("V10")).toBe(10);
  });

  it("accepts lowercase v prefix", () => {
    expect(parseGradeNum("v5")).toBe(5);
  });

  it("trims whitespace before parsing", () => {
    expect(parseGradeNum("  V3  ")).toBe(3);
  });

  it("throws for missing V prefix", () => {
    expect(() => parseGradeNum("5")).toThrow();
    expect(() => parseGradeNum("abc")).toThrow();
  });

  it("throws for empty string", () => {
    expect(() => parseGradeNum("")).toThrow();
  });

  it("throws for V prefix with no numeric remainder", () => {
    expect(() => parseGradeNum("V")).toThrow();
  });

  it("throws for V prefix with non-numeric remainder", () => {
    expect(() => parseGradeNum("VX")).toThrow();
  });
});

describe("parseHashtagsJson", () => {
  it("returns '[]' for null", () => {
    expect(parseHashtagsJson(null)).toBe("[]");
  });

  it("returns '[]' for undefined", () => {
    expect(parseHashtagsJson(undefined)).toBe("[]");
  });

  it("returns '[]' for empty string", () => {
    expect(parseHashtagsJson("")).toBe("[]");
  });

  it("returns '[]' for blank/whitespace string", () => {
    expect(parseHashtagsJson("   ")).toBe("[]");
  });

  it("parses a valid JSON array of strings", () => {
    expect(parseHashtagsJson('["안양","고물"]')).toBe('["안양","고물"]');
  });

  it("re-serializes a JSON array (normalizes formatting)", () => {
    expect(parseHashtagsJson('[ "안양" , "고물" ]')).toBe('["안양","고물"]');
  });

  it("drops non-string elements from array", () => {
    expect(parseHashtagsJson('[1,"a",null]')).toBe('["a"]');
  });

  it("returns '[]' for invalid JSON", () => {
    expect(parseHashtagsJson("not-json")).toBe("[]");
  });

  it("returns '[]' for valid JSON that is not an array", () => {
    expect(parseHashtagsJson('{"key":"value"}')).toBe("[]");
  });

  it("returns '[]' for JSON null", () => {
    expect(parseHashtagsJson("null")).toBe("[]");
  });
});
