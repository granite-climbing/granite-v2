import { z } from "zod";

type RawForm = Record<string, FormDataEntryValue | string | undefined>;

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      throw new Error("Invalid number");
    }
    return numberValue;
  });

const requiredNumber = z.union([z.string(), z.number()]).transform((value) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    throw new Error("Invalid number");
  }
  return numberValue;
});

const checkbox = z.union([z.string(), z.boolean(), z.undefined()]).transform((value) => value === "on" || value === true);

export const cragFormSchema = z.object({
  areaId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  lat: optionalNumber,
  lng: optionalNumber,
  summary: z.string().default(""),
  accessDesc: z.string().default(""),
  parkingDesc: z.string().default(""),
  season: z.string().default(""),
  coverImageUrl: z.string().default(""),
  isPublished: checkbox
});

export const boulderFormSchema = z.object({
  sectorId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  lat: requiredNumber,
  lng: requiredNumber,
  coordPrecision: z.enum(["exact", "approximate", "hidden"]),
  rockType: z.string().default(""),
  hashtags: z.string().transform((value) =>
    JSON.stringify(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
    )
  ),
  coverImageUrl: z.string().default(""),
  isPublished: checkbox
});

export const routeFormSchema = z.object({
  topoId: z.string().min(1),
  boulderId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  grade: z.string().min(1),
  gradeNum: requiredNumber,
  fa: z.string().default(""),
  description: z.string().default(""),
  lineImageUrl: z.string().default(""),
  isPublished: checkbox
});

export function parseCragForm(rawForm: RawForm) {
  return cragFormSchema.parse(rawForm);
}

export function parseBoulderForm(rawForm: RawForm) {
  return boulderFormSchema.parse(rawForm);
}

export function parseRouteForm(rawForm: RawForm) {
  return routeFormSchema.parse(rawForm);
}
