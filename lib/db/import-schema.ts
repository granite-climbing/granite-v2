/**
 * Zod schemas for validating the JSON workbook snapshot produced by
 * scripts/export-workbook.py before SQL generation.
 *
 * Design principles:
 * - Identity fields (slug, name, FK slugs) are required non-empty strings.
 * - Optional/display fields use z.coerce or nullable handling to tolerate
 *   empty/null cells from the spreadsheet.
 * - No `any` types.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** A non-empty string that must be present. */
const requiredString = z.string().min(1, "Required non-empty string");

/** A nullable/optional string cell from the workbook. null → empty string downstream. */
const optionalStringCell = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** A nullable lat/lng cell. Workbook stores these as strings or numbers. */
const coordinateCell = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isNaN(n) ? null : n;
  });

/** is_published workbook cell: "TRUE"/"FALSE"/boolean/number/null */
const publishedCell = z
  .union([z.string(), z.boolean(), z.number()])
  .nullable()
  .optional();

/** sort_order workbook cell: number or null */
const sortOrderCell = z.number().nullable().optional();

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

export const AreaRowSchema = z.object({
  slug:           requiredString,
  name:           requiredString,
  name_en:        optionalStringCell,
  sort_order:     sortOrderCell,
  // Areas sheet has no is_published column; default is applied in import script.
  // No cover_image_url in workbook; default empty string applied in import script.
});

export type AreaRow = z.infer<typeof AreaRowSchema>;

// ---------------------------------------------------------------------------
// Crags
// ---------------------------------------------------------------------------

export const CragRowSchema = z.object({
  slug:            requiredString,
  area_slug:       requiredString,
  name:            requiredString,
  name_en:         optionalStringCell,
  lat:             coordinateCell,
  lng:             coordinateCell,
  /** Legacy column kept in JSON; import script merges: description || summary */
  summary:         optionalStringCell,
  description:     optionalStringCell,
  season:          optionalStringCell,
  cover_image_url: optionalStringCell,
  is_published:    publishedCell,
});

export type CragRow = z.infer<typeof CragRowSchema>;

// ---------------------------------------------------------------------------
// Sectors
// ---------------------------------------------------------------------------

export const SectorRowSchema = z.object({
  crag_slug:       requiredString,
  slug:            requiredString,
  name:            requiredString,
  name_en:         optionalStringCell,
  lat:             coordinateCell,
  lng:             coordinateCell,
  description:     optionalStringCell,
  season:          optionalStringCell,
  cover_image_url: optionalStringCell,
  is_published:    publishedCell,
});

export type SectorRow = z.infer<typeof SectorRowSchema>;

// ---------------------------------------------------------------------------
// Boulders
// ---------------------------------------------------------------------------

export const BoulderRowSchema = z.object({
  slug:            requiredString,
  sector_slug:     requiredString,
  name:            requiredString,
  lat:             coordinateCell,
  lng:             coordinateCell,
  hashtags:        optionalStringCell,
  cover_image_url: optionalStringCell,
  is_published:    publishedCell,
});

export type BoulderRow = z.infer<typeof BoulderRowSchema>;

// ---------------------------------------------------------------------------
// Topos
// ---------------------------------------------------------------------------

export const TopoRowSchema = z.object({
  slug:           requiredString,
  boulder_slug:   requiredString,
  name:           requiredString,
  base_image_url: optionalStringCell,
  sort_order:     sortOrderCell,
  // Topos sheet has no is_published column; default is applied in import script.
});

export type TopoRow = z.infer<typeof TopoRowSchema>;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const RouteRowSchema = z.object({
  slug:           requiredString,
  topo_slug:      requiredString,
  /** boulder_slug is present in workbook as a validation aid only — not persisted. */
  boulder_slug:   optionalStringCell,
  name:           requiredString,
  /** Routes table has no name_en column; name_en from workbook is intentionally ignored. */
  name_en:        optionalStringCell,
  grade:          requiredString,
  grade_num:      z.number().nullable().optional(),
  fa:             optionalStringCell,
  description:    optionalStringCell,
  line_image_url: optionalStringCell,
  is_published:   publishedCell,
});

export type RouteRow = z.infer<typeof RouteRowSchema>;

// ---------------------------------------------------------------------------
// Full snapshot
// ---------------------------------------------------------------------------

export const WorkbookSnapshotSchema = z.object({
  areas:    z.array(AreaRowSchema),
  crags:    z.array(CragRowSchema),
  sectors:  z.array(SectorRowSchema),
  boulders: z.array(BoulderRowSchema),
  topos:    z.array(TopoRowSchema),
  routes:   z.array(RouteRowSchema),
});

export type WorkbookSnapshot = z.infer<typeof WorkbookSnapshotSchema>;
