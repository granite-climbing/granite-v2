/**
 * Pure import-normalization helpers.
 * No I/O. No imports of other app code.
 */

/**
 * Converts an arbitrary string to a snake_case slug:
 * lowercases, trims, replaces any run of whitespace/non-alphanumeric chars
 * with a single underscore, collapses repeated underscores, strips leading/
 * trailing underscores.
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Joins a prefix and slug with an underscore.
 * e.g. buildId("route", "anaconda") → "route_anaconda"
 */
export function buildId(prefix: string, slug: string): string {
  return `${prefix}_${slug}`;
}

/**
 * Coerces a spreadsheet cell value to boolean.
 * Truthy: boolean true, number 1, strings "true"/"1" (case-insensitive, trimmed).
 * Everything else is false.
 */
export function parseBooleanCell(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed === "true" || trimmed === "1";
  }
  return false;
}

/**
 * Parses a V-scale grade string to its integer value.
 * Accepts "V0"–"V17" (and lowercase "v"), trims whitespace.
 * Throws an Error for any invalid input.
 */
export function parseGradeNum(grade: string): number {
  const trimmed = grade.trim();
  if (trimmed === "") {
    throw new Error(`Invalid grade: "${grade}" — empty string`);
  }
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith("v")) {
    throw new Error(`Invalid grade: "${grade}" — missing V prefix`);
  }
  const remainder = lower.slice(1);
  if (remainder === "") {
    throw new Error(`Invalid grade: "${grade}" — no numeric value after V`);
  }
  const parsed = Number(remainder);
  if (!Number.isInteger(parsed) || isNaN(parsed)) {
    throw new Error(`Invalid grade: "${grade}" — non-numeric remainder "${remainder}"`);
  }
  return parsed;
}

/**
 * Normalizes a hashtag cell to a compact JSON string array suitable for
 * storage in a TEXT column.
 *
 * - null / undefined / empty / blank → "[]"
 * - valid JSON array → re-serialized, keeping only string elements
 * - invalid JSON or non-array → "[]"
 */
export function parseHashtagsJson(value: unknown): string {
  if (value === null || value === undefined) return "[]";
  if (typeof value !== "string") return "[]";
  const trimmed = value.trim();
  if (trimmed === "") return "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "[]";
  }

  if (!Array.isArray(parsed)) return "[]";

  const strings = parsed.filter((item): item is string => typeof item === "string");
  return JSON.stringify(strings);
}
