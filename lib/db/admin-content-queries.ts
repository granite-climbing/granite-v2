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

import { executeD1, queryD1First, queryD1 } from "./d1-http";

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

// Allowlist for parent column names used in WHERE clauses
const parentColumnAllowlist = new Set<string>(["area_id", "crag_id", "sector_id", "boulder_id", "topo_id"]);

function assertParentColumn(col: string): void {
  if (!parentColumnAllowlist.has(col)) {
    throw new Error(`Unsupported parentColumn: ${col}`);
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

  // Guard table name against SQL injection
  assertMutableTable(table, "findRowBySlug");

  if (parentColumn !== undefined && parentId !== undefined) {
    // Guard parent column name against SQL injection
    assertParentColumn(parentColumn);
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

// announcements: id, title, body, cover_image_url, crag_id, link_url,
//                is_published, published_at, sort_order
// NOTE: softDeleteAnnouncement / restoreAnnouncement delegate to the generic
//       softDeleteContent / restoreContent helpers (table:"announcements").
export async function upsertAnnouncement(input: {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string;
  cragId: string | null;
  linkUrl: string;
  isPublished: boolean;
  publishedAt: string;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO announcements
       (id, title, body, cover_image_url, crag_id, link_url, is_published, published_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title           = excluded.title,
       body            = excluded.body,
       cover_image_url = excluded.cover_image_url,
       crag_id         = excluded.crag_id,
       link_url        = excluded.link_url,
       is_published    = excluded.is_published,
       published_at    = excluded.published_at,
       sort_order      = excluded.sort_order,
       updated_at      = datetime('now')`,
    [
      input.id,
      input.title,
      input.body,
      input.coverImageUrl,
      input.cragId,
      input.linkUrl,
      input.isPublished ? 1 : 0,
      input.publishedAt,
      input.sortOrder,
    ],
  );
}

// ---------------------------------------------------------------------------
// Ancestry helpers — resolve parent slugs/ids server-side for cache invalidation.
// These do NOT filter deleted_at so admin can invalidate after soft-deletes.
// ---------------------------------------------------------------------------

/**
 * Returns the slug of an area by its id, or null if not found.
 */
export async function getAreaSlugByAreaId(id: string): Promise<string | null> {
  const row = await queryD1First<{ slug: string }>(
    "SELECT slug FROM areas WHERE id = ?",
    [id],
  );
  return row?.slug ?? null;
}

/**
 * Returns the slug of a crag by its id, or null if not found.
 */
export async function getCragSlugByCragId(id: string): Promise<string | null> {
  const row = await queryD1First<{ slug: string }>(
    "SELECT slug FROM crags WHERE id = ?",
    [id],
  );
  return row?.slug ?? null;
}

/**
 * Returns { cragSlug, sectorSlug } for a sector, or null if not found.
 */
export async function getSectorAncestry(
  id: string,
): Promise<{ cragSlug: string; sectorSlug: string } | null> {
  const row = await queryD1First<{ cragSlug: string; sectorSlug: string }>(
    `SELECT c.slug AS cragSlug, s.slug AS sectorSlug
     FROM sectors s
     JOIN crags c ON c.id = s.crag_id
     WHERE s.id = ?`,
    [id],
  );
  return row ?? null;
}

/**
 * Returns { cragSlug, sectorSlug } for a boulder (via its parent sector), or null if not found.
 */
export async function getBoulderAncestry(
  id: string,
): Promise<{ cragSlug: string; sectorSlug: string } | null> {
  const row = await queryD1First<{ cragSlug: string; sectorSlug: string }>(
    `SELECT c.slug AS cragSlug, s.slug AS sectorSlug
     FROM boulders b
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     WHERE b.id = ?`,
    [id],
  );
  return row ?? null;
}

/**
 * Returns { cragSlug, boulderId } for a topo, or null if not found.
 */
export async function getTopoAncestry(
  id: string,
): Promise<{ cragSlug: string; boulderId: string } | null> {
  const row = await queryD1First<{ cragSlug: string; boulderId: string }>(
    `SELECT c.slug AS cragSlug, b.id AS boulderId
     FROM topos t
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     WHERE t.id = ?`,
    [id],
  );
  return row ?? null;
}

/**
 * Returns { cragSlug, boulderId, topoId } for a route, or null if not found.
 */
export async function getRouteAncestry(
  id: string,
): Promise<{ cragSlug: string; boulderId: string; topoId: string } | null> {
  const row = await queryD1First<{ cragSlug: string; boulderId: string; topoId: string }>(
    `SELECT c.slug AS cragSlug, b.id AS boulderId, t.id AS topoId
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     WHERE r.id = ?`,
    [id],
  );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Descendant id enumeration — used by save actions to flush stale caches
// when an entity is moved to a different parent.
// NOTE: deleted_at is intentionally NOT filtered — we want to flush caches
// for soft-deleted descendants too.
// ---------------------------------------------------------------------------

/**
 * Returns all boulder/topo/route ids that are descendants of the given sector.
 */
export async function getSectorDescendantIds(sectorId: string): Promise<{
  boulderIds: string[];
  topoIds: string[];
  routeIds: string[];
}> {
  const [boulderRows, topoRows, routeRows] = await Promise.all([
    queryD1<{ id: string }>(
      "SELECT id FROM boulders WHERE sector_id = ?",
      [sectorId],
    ),
    queryD1<{ id: string }>(
      `SELECT t.id
       FROM topos t
       JOIN boulders b ON b.id = t.boulder_id
       WHERE b.sector_id = ?`,
      [sectorId],
    ),
    queryD1<{ id: string }>(
      `SELECT r.id
       FROM routes r
       JOIN topos t ON t.id = r.topo_id
       JOIN boulders b ON b.id = t.boulder_id
       WHERE b.sector_id = ?`,
      [sectorId],
    ),
  ]);
  return {
    boulderIds: boulderRows.map((r) => r.id),
    topoIds: topoRows.map((r) => r.id),
    routeIds: routeRows.map((r) => r.id),
  };
}

/**
 * Returns all topo/route ids that are descendants of the given boulder.
 */
export async function getBoulderDescendantIds(boulderId: string): Promise<{
  topoIds: string[];
  routeIds: string[];
}> {
  const [topoRows, routeRows] = await Promise.all([
    queryD1<{ id: string }>(
      "SELECT id FROM topos WHERE boulder_id = ?",
      [boulderId],
    ),
    queryD1<{ id: string }>(
      `SELECT r.id
       FROM routes r
       JOIN topos t ON t.id = r.topo_id
       WHERE t.boulder_id = ?`,
      [boulderId],
    ),
  ]);
  return {
    topoIds: topoRows.map((r) => r.id),
    routeIds: routeRows.map((r) => r.id),
  };
}

/**
 * Returns all route ids that are descendants of the given topo.
 */
export async function getTopoDescendantIds(topoId: string): Promise<{
  routeIds: string[];
}> {
  const routeRows = await queryD1<{ id: string }>(
    "SELECT id FROM routes WHERE topo_id = ?",
    [topoId],
  );
  return {
    routeIds: routeRows.map((r) => r.id),
  };
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
