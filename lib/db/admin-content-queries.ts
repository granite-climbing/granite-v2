/**
 * Admin content SQL mutation functions.
 *
 * All mutations go through executeD1 (d1-http).
 * Read-only helpers (findRowBySlug) use queryD1First.
 *
 * Table-name interpolation is guarded by the mutableTables allowlist —
 * this is the SQL-injection defense; never bypass the guard.
 *
 * Soft-delete vs. UNIQUE(slug) contract
 * ─────────────────────────────────────
 * Soft-deleted rows keep occupying their UNIQUE slug slot because SQLite
 * cannot scope a UNIQUE constraint to `deleted_at IS NULL` without
 * rebuilding the table (out of scope for roll-forward migrations).
 *
 * Before inserting a NEW record (no id / new id) the Task 8 action layer MUST:
 *   1. Call `findRowBySlug` with the target table + slug (+ parent scope if any).
 *   2. If the returned row has `deleted_at !== null` → restore-and-update that
 *      row's id instead of inserting a brand-new row.
 *   3. If the returned row has `deleted_at === null` → reject with a
 *      "slug already in use" error (live row, not safe to reuse).
 *   4. If null → proceed with a normal insert/upsert.
 *
 * This file exposes `findRowBySlug` as the lookup primitive; the action
 * layer (Task 8) wires the full resolution flow.
 */

import { executeD1, queryD1First } from "./d1-http";

// ---------------------------------------------------------------------------
// Allowed tables for table-name interpolation
// ---------------------------------------------------------------------------

type MutableTable =
  | "areas"
  | "crags"
  | "sectors"
  | "boulders"
  | "topos"
  | "routes"
  | "announcements";

const mutableTables = new Set<string>([
  "areas",
  "crags",
  "sectors",
  "boulders",
  "topos",
  "routes",
  "announcements",
]);

function assertMutableTable(table: string, op: string): asserts table is MutableTable {
  if (!mutableTables.has(table)) {
    throw new Error(`Unsupported ${op} table: ${table}`);
  }
}

// ---------------------------------------------------------------------------
// Constrained table helpers
// ---------------------------------------------------------------------------

export async function updatePublishState(input: {
  table: MutableTable;
  id: string;
  isPublished: boolean;
}): Promise<void> {
  assertMutableTable(input.table, "publish");
  await executeD1(
    `UPDATE ${input.table} SET is_published = ?, updated_at = datetime('now') WHERE id = ?`,
    [input.isPublished ? 1 : 0, input.id],
  );
}

export async function softDeleteContent(input: {
  table: MutableTable;
  id: string;
}): Promise<void> {
  assertMutableTable(input.table, "soft-delete");
  await executeD1(
    `UPDATE ${input.table} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [input.id],
  );
}

export async function restoreContent(input: {
  table: MutableTable;
  id: string;
}): Promise<void> {
  assertMutableTable(input.table, "restore");
  await executeD1(
    `UPDATE ${input.table} SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [input.id],
  );
}

// ---------------------------------------------------------------------------
// Slug lookup primitive (soft-delete vs UNIQUE collision guard)
// ---------------------------------------------------------------------------

/**
 * Find any row (including soft-deleted) with the given slug in the given table.
 *
 * For globally-unique slug tables (areas, crags): pass only table + slug.
 * For parent-scoped slug tables (sectors/boulders: UNIQUE(parent,slug),
 * routes: UNIQUE(topo_id,slug)): also pass parentColumn + parentId.
 *
 * Returns { id, deleted_at } or null.
 * The Task 8 action layer uses this to decide whether to restore-and-update
 * (deleted_at !== null) or reject (deleted_at === null, live row).
 */
export async function findRowBySlug(input: {
  table: MutableTable;
  slug: string;
  parentColumn?: string;
  parentId?: string;
}): Promise<{ id: string; deleted_at: string | null } | null> {
  const { table, slug, parentColumn, parentId } = input;

  if (parentColumn !== undefined && parentId !== undefined) {
    return queryD1First<{ id: string; deleted_at: string | null }>(
      `SELECT id, deleted_at FROM ${table} WHERE slug = ? AND ${parentColumn} = ?`,
      [slug, parentId],
    );
  }

  return queryD1First<{ id: string; deleted_at: string | null }>(
    `SELECT id, deleted_at FROM ${table} WHERE slug = ?`,
    [slug],
  );
}

// ---------------------------------------------------------------------------
// Explicit upsert functions
// ---------------------------------------------------------------------------

// areas: id, name, name_en, slug, cover_image_url, is_published, sort_order
export async function upsertArea(input: {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO areas
       (id, name, name_en, slug, cover_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name            = excluded.name,
       name_en         = excluded.name_en,
       slug            = excluded.slug,
       cover_image_url = excluded.cover_image_url,
       is_published    = excluded.is_published,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.name,
      input.nameEn,
      input.slug,
      input.coverImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}

// crags: id, area_id, name, name_en, slug, lat, lng, description, season,
//        cover_image_url, is_published, sort_order
export async function upsertCrag(input: {
  id: string;
  areaId: string;
  name: string;
  nameEn: string | null;
  slug: string;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO crags
       (id, area_id, name, name_en, slug, lat, lng, description, season, cover_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       area_id         = excluded.area_id,
       name            = excluded.name,
       name_en         = excluded.name_en,
       slug            = excluded.slug,
       lat             = excluded.lat,
       lng             = excluded.lng,
       description     = excluded.description,
       season          = excluded.season,
       cover_image_url = excluded.cover_image_url,
       is_published    = excluded.is_published,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.areaId,
      input.name,
      input.nameEn,
      input.slug,
      input.lat,
      input.lng,
      input.description,
      input.season,
      input.coverImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}

// sectors: id, crag_id, name, name_en, slug, lat, lng, description, season,
//          cover_image_url, is_published, sort_order
export async function upsertSector(input: {
  id: string;
  cragId: string;
  name: string;
  nameEn: string | null;
  slug: string;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO sectors
       (id, crag_id, name, name_en, slug, lat, lng, description, season, cover_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       crag_id         = excluded.crag_id,
       name            = excluded.name,
       name_en         = excluded.name_en,
       slug            = excluded.slug,
       lat             = excluded.lat,
       lng             = excluded.lng,
       description     = excluded.description,
       season          = excluded.season,
       cover_image_url = excluded.cover_image_url,
       is_published    = excluded.is_published,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.cragId,
      input.name,
      input.nameEn,
      input.slug,
      input.lat,
      input.lng,
      input.description,
      input.season,
      input.coverImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}

// boulders: id, sector_id, name, slug, lat, lng, hashtags, cover_image_url,
//           is_published, sort_order
// NOTE: boulders has NO name_en, NO description, NO season columns.
// hashtags is already a JSON string (e.g. '["슬랩","크림프"]') — pass as-is.
export async function upsertBoulder(input: {
  id: string;
  sectorId: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  hashtags: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO boulders
       (id, sector_id, name, slug, lat, lng, hashtags, cover_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sector_id       = excluded.sector_id,
       name            = excluded.name,
       slug            = excluded.slug,
       lat             = excluded.lat,
       lng             = excluded.lng,
       hashtags        = excluded.hashtags,
       cover_image_url = excluded.cover_image_url,
       is_published    = excluded.is_published,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.sectorId,
      input.name,
      input.slug,
      input.lat,
      input.lng,
      input.hashtags,
      input.coverImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}

// topos: id, boulder_id, name, base_image_url, is_published, sort_order
export async function upsertTopo(input: {
  id: string;
  boulderId: string;
  name: string;
  baseImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO topos
       (id, boulder_id, name, base_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       boulder_id      = excluded.boulder_id,
       name            = excluded.name,
       base_image_url  = excluded.base_image_url,
       is_published    = excluded.is_published,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.boulderId,
      input.name,
      input.baseImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}

// routes: id, topo_id, name, slug, grade, grade_num, fa, description,
//         line_image_url, is_published, sort_order
// NOTE: routes has NO boulder_id column. Parent is topo_id only.
export async function upsertRoute(input: {
  id: string;
  topoId: string;
  name: string;
  slug: string;
  grade: string;
  gradeNum: number;
  fa: string;
  description: string;
  lineImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO routes
       (id, topo_id, name, slug, grade, grade_num, fa, description, line_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       topo_id         = excluded.topo_id,
       name            = excluded.name,
       slug            = excluded.slug,
       grade           = excluded.grade,
       grade_num       = excluded.grade_num,
       fa              = excluded.fa,
       description     = excluded.description,
       line_image_url  = excluded.line_image_url,
       is_published    = excluded.is_published,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.topoId,
      input.name,
      input.slug,
      input.grade,
      input.gradeNum,
      input.fa,
      input.description,
      input.lineImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}
