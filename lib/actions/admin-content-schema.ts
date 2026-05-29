import { z } from "zod";
import { normalizeSlug, parseGradeNum } from "@/lib/db/import-normalize";

type RawForm = Record<string, FormDataEntryValue | string | undefined>;

const optionalId = z.string().trim().optional().transform((value) => value || null);
const requiredText = z.string().trim().min(1);
const optionalText = z.string().optional().transform((value) => value?.trim() ?? "");
const nullableText = z.string().optional().transform((value) => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
});

const slug = requiredText.refine((value) => normalizeSlug(value) === value, {
  message: "Slug must be lowercase snake_case",
});

const optionalNumber = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value, ctx) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid number" });
    return z.NEVER;
  }
  return parsed;
});

const requiredNumber = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid number" });
    return z.NEVER;
  }
  return parsed;
});

const sortOrder = z.union([z.string(), z.number(), z.undefined()]).transform((value, ctx) => {
  if (value === undefined || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid sort order" });
    return z.NEVER;
  }
  return parsed;
});

const checkbox = z.union([z.string(), z.boolean(), z.undefined()]).transform((value) => value === "on" || value === true);

// Derive the allowed CDN host from CDN_BASE_URL once at module load so every
// parse call reuses the same value. Falls back to the default CDN origin if
// CDN_BASE_URL is missing or malformed.
const CDN_ORIGIN: string = (() => {
  try {
    return new URL(process.env.CDN_BASE_URL ?? "https://cdn.granite.kr").origin;
  } catch {
    return "https://cdn.granite.kr";
  }
})();

const cdnUrl = z.string().trim().default("").refine(
  (value) => {
    if (value === "" || value.startsWith("/")) return true;
    try {
      return new URL(value).origin === CDN_ORIGIN;
    } catch {
      return false;
    }
  },
  { message: "Image URL must be empty, a CDN URL on CDN_BASE_URL's host, or an approved CDN path" },
);

export const areaFormSchema = z.object({
  id: optionalId,
  name: requiredText,
  nameEn: nullableText,
  slug,
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const cragFormSchema = z.object({
  id: optionalId,
  areaId: requiredText,
  name: requiredText,
  nameEn: nullableText,
  slug,
  lat: optionalNumber,
  lng: optionalNumber,
  description: optionalText,
  season: optionalText,
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const sectorFormSchema = z.object({
  id: optionalId,
  cragId: requiredText,
  name: requiredText,
  nameEn: nullableText,
  slug,
  lat: optionalNumber,
  lng: optionalNumber,
  description: optionalText,
  season: optionalText,
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const boulderFormSchema = z.object({
  id: optionalId,
  sectorId: requiredText,
  name: requiredText,
  slug,
  lat: requiredNumber,
  lng: requiredNumber,
  hashtags: z.string().default("").transform((value) =>
    JSON.stringify(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ),
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const topoFormSchema = z.object({
  id: optionalId,
  boulderId: requiredText,
  name: requiredText,
  baseImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

// gradeNum is parsed at object level so it can fall back to `grade` when blank.
const routeFormSchemaBase = z.object({
  id: optionalId,
  topoId: requiredText,
  name: requiredText,
  slug,
  grade: requiredText,
  // Accept raw input only — numeric coercion happens in the object-level transform below.
  gradeNum: z.union([z.string(), z.number()]).optional(),
  fa: optionalText,
  description: optionalText,
  lineImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const routeFormSchema = routeFormSchemaBase.transform((data, ctx) => {
  let gradeNum: number;

  if (data.gradeNum !== undefined && data.gradeNum !== "") {
    const n = Number(data.gradeNum);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid grade number", path: ["gradeNum"] });
      return z.NEVER;
    }
    gradeNum = n;
  } else {
    // grade is requiredText so it is always a non-empty string here.
    gradeNum = parseGradeNum(data.grade);
  }

  return { ...data, gradeNum };
});

export function parseAreaForm(rawForm: RawForm) {
  return areaFormSchema.parse(rawForm);
}

export function parseCragForm(rawForm: RawForm) {
  return cragFormSchema.parse(rawForm);
}

export function parseSectorForm(rawForm: RawForm) {
  return sectorFormSchema.parse(rawForm);
}

export function parseBoulderForm(rawForm: RawForm) {
  return boulderFormSchema.parse(rawForm);
}

export function parseTopoForm(rawForm: RawForm) {
  return topoFormSchema.parse(rawForm);
}

export function parseRouteForm(rawForm: RawForm) {
  return routeFormSchema.parse(rawForm);
}
