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

const optionalNumber = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error("Invalid number");
  return parsed;
});

const requiredNumber = z.union([z.string(), z.number()]).transform((value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error("Invalid number");
  return parsed;
});

const sortOrder = z.union([z.string(), z.number(), z.undefined()]).transform((value) => {
  if (value === undefined || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Invalid sort order");
  return parsed;
});

const checkbox = z.union([z.string(), z.boolean(), z.undefined()]).transform((value) => value === "on" || value === true);

// Derive the allowed CDN host from CDN_BASE_URL so this stays in lockstep with
// lib/r2/images.ts (buildCdnImageUrl). Do NOT hardcode the host here — the
// public domain is configured via env and may differ between environments.
function cdnOrigin(): string {
  const base = process.env.CDN_BASE_URL ?? "https://cdn.granite.kr";
  return new URL(base).origin;
}

const cdnUrl = z.string().trim().default("").refine(
  (value) => {
    if (value === "" || value.startsWith("/")) return true;
    try {
      return new URL(value).origin === cdnOrigin();
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

export const routeFormSchema = z.object({
  id: optionalId,
  topoId: requiredText,
  name: requiredText,
  slug,
  grade: requiredText,
  gradeNum: z.union([z.string(), z.number(), z.undefined()]).transform((value) => {
    if (value === undefined || value === "") return parseGradeNum(String(value));
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error("Invalid grade number");
    return parsed;
  }),
  fa: optionalText,
  description: optionalText,
  lineImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
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
