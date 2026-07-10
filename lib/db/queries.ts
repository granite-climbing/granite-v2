/**
 * Typed public read queries for Cloudflare D1.
 *
 * All functions return only published rows (is_published = 1) and require
 * all ancestor rows in the chain to also be published.
 *
 * Design split:
 *  - gradeRange computation is done IN SQL (MIN/MAX via aggregate) and
 *    formatted in TS with `formatGradeRange`.
 *  - hashtagsList is returned as a raw JSON string from the DB; callers
 *    (or this module's mappers) parse it via `parseHashtags`.
 *  - topoIndex / topoCount are computed by the repository using
 *    `getBoulderTopos` (ordered by sort_order) rather than in SQL, to
 *    keep queries simple and composable.
 *  - Per-crag / per-area stats are computed by the repository using
 *    `getAllCragStats` (one grouped query for every crag).
 *
 * Batching: functions used by the repository's cached loaders also expose a
 * `xxxQuery()` descriptor builder (see `D1Query` in d1-http.ts) so several
 * logical queries can share ONE D1 HTTP round trip via `batchD1`. The plain
 * async function and its descriptor always share the same SQL and mapper.
 */

import { queryD1, queryD1First, type D1Query } from "./d1-http";
import type {
  Announcement,
  Area,
  Boulder,
  Crag,
  CragLocation,
  GradeBand,
  RouteListItem,
  Route,
  SearchBoulderResult,
  SearchResults,
  SearchSectorResult,
  Sector,
  Stats,
  Topo,
} from "./schema";

// Re-export so that consumers can use `queries.RouteListItem` as a type
export type { RouteListItem };

// ---------------------------------------------------------------------------
// Internal row shapes (snake_case → camelCase via SQL aliases, is_published as 0|1)
// ---------------------------------------------------------------------------

interface AreaRow {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  coverImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
}

interface CragRow {
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
  isPublished: 0 | 1;
  sortOrder: number;
}

interface SectorRow {
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
  isPublished: 0 | 1;
  sortOrder: number;
}

interface BoulderRow {
  id: string;
  sectorId: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  hashtags: string;
  coverImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
}

interface BoulderWithStatsRow extends BoulderRow {
  routeCount: number;
  minGrade: number | null;
  maxGrade: number | null;
}

interface TopoRow {
  id: string;
  boulderId: string;
  name: string;
  baseImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
}

interface RouteRow {
  id: string;
  topoId: string;
  name: string;
  slug: string;
  grade: string;
  gradeNum: number;
  fa: string;
  description: string;
  lineImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
}

interface RouteListItemRow extends RouteRow {
  boulderId: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  cragSlug: string;
  sectorSlug: string;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string;
  cragId: string | null;
  linkUrl: string;
  isPublished: 0 | 1;
  publishedAt: string;
  sortOrder: number;
}

interface StatsRow {
  crags: number;
  sectors: number;
  boulders: number;
  routes: number;
}

interface SearchAreaRow extends AreaRow {
  crags: number;
  sectors: number;
  boulders: number;
  routes: number;
}

interface SearchCragRow extends CragRow {
  sectors: number;
  boulders: number;
  routes: number;
}

interface SearchSectorRow extends SectorRow {
  cragName: string;
  cragSlug: string;
  boulderCount: number;
  routeCount: number;
}

interface SearchBoulderRow extends BoulderWithStatsRow {
  sectorName: string;
  sectorSlug: string;
  cragName: string;
  cragSlug: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapArea(row: AreaRow): Area {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapCrag(row: CragRow): Crag {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapSector(row: SectorRow): Sector {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapBoulder(row: BoulderRow): Boulder {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapTopo(row: TopoRow): Topo {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapRoute(row: RouteRow): Route {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapRouteListItem(row: RouteListItemRow): RouteListItem {
  return { ...row, isPublished: row.isPublished === 1 };
}

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return { ...row, isPublished: row.isPublished === 1 };
}

function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Parse hashtags JSON string from the boulder row. Returns [] on error. */
export function parseHashtags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/**
 * Format grade range from DB aggregates.
 * SQL returns NULL for min/max when there are no routes.
 */
export function formatGradeRange(
  minGrade: number | null,
  maxGrade: number | null
): string {
  if (minGrade === null || maxGrade === null) return "—";
  if (minGrade === maxGrade) return `V${minGrade}`;
  return `V${minGrade}-V${maxGrade}`;
}

/** Run a single descriptor over its own HTTP request (non-batched path). */
async function runQuery<T>(q: D1Query<T>): Promise<T> {
  return q.map(await queryD1<unknown>(q.sql, q.params));
}

// ---------------------------------------------------------------------------
// 1. Stats
// ---------------------------------------------------------------------------

/**
 * Global published counts requiring full ancestor chain to be published.
 * - sectors: parent crag AND parent area must be published
 * - boulders: parent sector AND crag AND area published
 * - routes: parent topo published (topo has no is_published gate in the
 *   ancestor chain beyond boulder→sector→crag→area)
 */
export function statsQuery(): D1Query<Stats> {
  return {
    sql: `SELECT
       (SELECT COUNT(*)
        FROM crags c
        JOIN areas a ON a.id = c.area_id
        WHERE c.is_published = 1 AND a.is_published = 1
          AND c.deleted_at IS NULL AND a.deleted_at IS NULL
       ) AS crags,
       (SELECT COUNT(*)
        FROM sectors s
        JOIN crags c ON c.id = s.crag_id
        JOIN areas a ON a.id = c.area_id
        WHERE s.is_published = 1 AND c.is_published = 1 AND a.is_published = 1
          AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND a.deleted_at IS NULL
       ) AS sectors,
       (SELECT COUNT(*)
        FROM boulders b
        JOIN sectors s ON s.id = b.sector_id
        JOIN crags c ON c.id = s.crag_id
        JOIN areas a ON a.id = c.area_id
        WHERE b.is_published = 1 AND s.is_published = 1
          AND c.is_published = 1 AND a.is_published = 1
          AND b.deleted_at IS NULL AND s.deleted_at IS NULL
          AND c.deleted_at IS NULL AND a.deleted_at IS NULL
       ) AS boulders,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        JOIN sectors s ON s.id = b.sector_id
        JOIN crags c ON c.id = s.crag_id
        JOIN areas a ON a.id = c.area_id
        WHERE r.is_published = 1 AND t.is_published = 1
          AND b.is_published = 1 AND s.is_published = 1
          AND c.is_published = 1 AND a.is_published = 1
          AND r.deleted_at IS NULL AND t.deleted_at IS NULL
          AND b.deleted_at IS NULL AND s.deleted_at IS NULL
          AND c.deleted_at IS NULL AND a.deleted_at IS NULL
       ) AS routes`,
    params: [],
    map: (rows) =>
      (rows as StatsRow[])[0] ?? { crags: 0, sectors: 0, boulders: 0, routes: 0 },
  };
}

export async function getStats(): Promise<Stats> {
  return runQuery(statsQuery());
}

// ---------------------------------------------------------------------------
// 2. Areas + crags
// ---------------------------------------------------------------------------

/** Published areas ordered by sort_order, then id. */
export function publishedAreasQuery(): D1Query<Area[]> {
  return {
    sql: `SELECT
       id,
       name,
       name_en        AS nameEn,
       slug,
       cover_image_url AS coverImageUrl,
       is_published    AS isPublished,
       sort_order      AS sortOrder
     FROM areas
     WHERE is_published = 1
       AND deleted_at IS NULL
     ORDER BY sort_order, id`,
    params: [],
    map: (rows) => (rows as AreaRow[]).map(mapArea),
  };
}

export async function getPublishedAreas(): Promise<Area[]> {
  return runQuery(publishedAreasQuery());
}

/**
 * All published, non-soft-deleted crags whose parent area is also published
 * and non-soft-deleted. Returns a flat list ordered by sort_order ASC, then
 * name ASC. Used by the home page all-Crags slider.
 */
export function allPublishedCragsQuery(): D1Query<Crag[]> {
  return {
    sql: `SELECT
       c.id,
       c.area_id        AS areaId,
       c.name,
       c.name_en        AS nameEn,
       c.slug,
       c.lat,
       c.lng,
       c.description,
       c.season,
       c.cover_image_url AS coverImageUrl,
       c.is_published    AS isPublished,
       c.sort_order      AS sortOrder
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE c.is_published = 1
       AND a.is_published = 1
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY c.sort_order ASC, c.name ASC`,
    params: [],
    map: (rows) => (rows as CragRow[]).map(mapCrag),
  };
}

export async function getAllPublishedCrags(): Promise<Crag[]> {
  return runQuery(allPublishedCragsQuery());
}

/**
 * Published crags for a given area, ordered by sort_order then id.
 * Used by the repository's Area detail loader (`loadAreaBySlug`) and by
 * `loadAllRouteItems`. The home model uses `getAllPublishedCrags` instead.
 */
export function cragsByAreaIdQuery(areaId: string): D1Query<Crag[]> {
  return {
    sql: `SELECT
       c.id,
       c.area_id        AS areaId,
       c.name,
       c.name_en        AS nameEn,
       c.slug,
       c.lat,
       c.lng,
       c.description,
       c.season,
       c.cover_image_url AS coverImageUrl,
       c.is_published    AS isPublished,
       c.sort_order      AS sortOrder
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE c.is_published = 1
       AND a.is_published = 1
       AND c.area_id = ?
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY c.sort_order, c.id`,
    params: [areaId],
    map: (rows) => (rows as CragRow[]).map(mapCrag),
  };
}

export async function getCragsByAreaId(areaId: string): Promise<Crag[]> {
  return runQuery(cragsByAreaIdQuery(areaId));
}

/**
 * Published-ancestor-aware stats for a single crag.
 * Returns sector/boulder/route counts. Used by the repository to build
 * per-crag stats in HomeModel and CragDetail.
 */
export function cragStatsQuery(
  cragId: string
): D1Query<Omit<Stats, "crags">> {
  return {
    sql: `SELECT
       (SELECT COUNT(*)
        FROM sectors s
        WHERE s.crag_id = ? AND s.is_published = 1
          AND s.deleted_at IS NULL
       ) AS sectors,
       (SELECT COUNT(*)
        FROM boulders b
        JOIN sectors s ON s.id = b.sector_id
        WHERE s.crag_id = ? AND s.is_published = 1 AND b.is_published = 1
          AND s.deleted_at IS NULL AND b.deleted_at IS NULL
       ) AS boulders,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        JOIN sectors s ON s.id = b.sector_id
        WHERE s.crag_id = ?
          AND s.is_published = 1
          AND b.is_published = 1
          AND t.is_published = 1
          AND r.is_published = 1
          AND s.deleted_at IS NULL
          AND b.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND r.deleted_at IS NULL
       ) AS routes`,
    params: [cragId, cragId, cragId],
    map: (rows) =>
      (rows as Omit<Stats, "crags">[])[0] ?? {
        sectors: 0,
        boulders: 0,
        routes: 0,
      },
  };
}

export async function getCragStats(
  cragId: string
): Promise<Omit<Stats, "crags">> {
  return runQuery(cragStatsQuery(cragId));
}

/**
 * Published-ancestor-aware stats for EVERY published crag in ONE query
 * (optionally scoped to an area). Same per-crag semantics as `getCragStats`,
 * but avoids one HTTP round trip per crag on the home and area pages.
 */
export function allCragStatsQuery(
  areaId?: string
): D1Query<Array<{ cragId: string } & Omit<Stats, "crags">>> {
  return {
    sql: `SELECT
       c.id AS cragId,
       (SELECT COUNT(*)
        FROM sectors s
        WHERE s.crag_id = c.id AND s.is_published = 1
          AND s.deleted_at IS NULL
       ) AS sectors,
       (SELECT COUNT(*)
        FROM boulders b
        JOIN sectors s ON s.id = b.sector_id
        WHERE s.crag_id = c.id AND s.is_published = 1 AND b.is_published = 1
          AND s.deleted_at IS NULL AND b.deleted_at IS NULL
       ) AS boulders,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        JOIN sectors s ON s.id = b.sector_id
        WHERE s.crag_id = c.id
          AND s.is_published = 1
          AND b.is_published = 1
          AND t.is_published = 1
          AND r.is_published = 1
          AND s.deleted_at IS NULL
          AND b.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND r.deleted_at IS NULL
       ) AS routes
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE c.is_published = 1
       AND a.is_published = 1
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
       ${areaId !== undefined ? "AND c.area_id = ?" : ""}`,
    params: areaId !== undefined ? [areaId] : [],
    map: (rows) => rows as Array<{ cragId: string } & Omit<Stats, "crags">>,
  };
}

export async function getAllCragStats(
  areaId?: string
): Promise<Array<{ cragId: string } & Omit<Stats, "crags">>> {
  return runQuery(allCragStatsQuery(areaId));
}

// ---------------------------------------------------------------------------
// 3. Announcements
// ---------------------------------------------------------------------------

export function publishedAnnouncementsQuery(): D1Query<Announcement[]> {
  return {
    sql: `SELECT
       id,
       title,
       body,
       cover_image_url AS coverImageUrl,
       crag_id         AS cragId,
       link_url        AS linkUrl,
       is_published    AS isPublished,
       published_at    AS publishedAt,
       sort_order      AS sortOrder
     FROM announcements
     WHERE is_published = 1
       AND deleted_at IS NULL
     ORDER BY sort_order, id`,
    params: [],
    map: (rows) => (rows as AnnouncementRow[]).map(mapAnnouncement),
  };
}

export async function getPublishedAnnouncements(): Promise<Announcement[]> {
  return runQuery(publishedAnnouncementsQuery());
}

// ---------------------------------------------------------------------------
// 4. Crag by slug
// ---------------------------------------------------------------------------

export function cragBySlugQuery(slug: string): D1Query<Crag | null> {
  return {
    sql: `SELECT
       c.id,
       c.area_id        AS areaId,
       c.name,
       c.name_en        AS nameEn,
       c.slug,
       c.lat,
       c.lng,
       c.description,
       c.season,
       c.cover_image_url AS coverImageUrl,
       c.is_published    AS isPublished,
       c.sort_order      AS sortOrder
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE c.slug = ?
       AND c.is_published = 1
       AND a.is_published = 1
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL`,
    params: [slug],
    map: (rows) => {
      const row = (rows as CragRow[])[0];
      return row ? mapCrag(row) : null;
    },
  };
}

export async function getCragBySlug(slug: string): Promise<Crag | null> {
  return runQuery(cragBySlugQuery(slug));
}

// ---------------------------------------------------------------------------
// 5. Sectors for a crag
// ---------------------------------------------------------------------------

export function cragSectorsQuery(cragId: string): D1Query<Sector[]> {
  return {
    sql: `SELECT
       s.id,
       s.crag_id        AS cragId,
       s.name,
       s.name_en        AS nameEn,
       s.slug,
       s.lat,
       s.lng,
       s.description,
       s.season,
       s.cover_image_url AS coverImageUrl,
       s.is_published    AS isPublished,
       s.sort_order      AS sortOrder
     FROM sectors s
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE s.crag_id = ?
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY s.sort_order, s.id`,
    params: [cragId],
    map: (rows) => (rows as SectorRow[]).map(mapSector),
  };
}

export async function getCragSectors(cragId: string): Promise<Sector[]> {
  return runQuery(cragSectorsQuery(cragId));
}

// ---------------------------------------------------------------------------
// 6. Boulders with stats for a crag (or sector)
// ---------------------------------------------------------------------------

/**
 * Published boulders under a crag with precomputed routeCount, minGrade,
 * maxGrade (use `formatGradeRange` to render), and raw hashtags string.
 *
 * gradeRange is computed in SQL (MIN/MAX of grade_num over published routes).
 * hashtagsList is parsed in TS via `parseHashtags`.
 * Pass sectorId to scope to a single sector.
 */
export function cragBouldersWithStatsQuery(
  cragId: string,
  sectorId?: string
): D1Query<
  Array<
    Boulder & {
      routeCount: number;
      gradeRange: string;
      hashtagsList: string[];
    }
  >
> {
  const sql = `
    SELECT
      b.id,
      b.sector_id        AS sectorId,
      b.name,
      b.slug,
      b.lat,
      b.lng,
      b.hashtags,
      b.cover_image_url  AS coverImageUrl,
      b.is_published     AS isPublished,
      b.sort_order       AS sortOrder,
      COUNT(r.id)        AS routeCount,
      MIN(r.grade_num)   AS minGrade,
      MAX(r.grade_num)   AS maxGrade
    FROM boulders b
    JOIN sectors s ON s.id = b.sector_id
    JOIN crags c ON c.id = s.crag_id
    JOIN areas a ON a.id = c.area_id
    LEFT JOIN topos t ON t.boulder_id = b.id AND t.is_published = 1 AND t.deleted_at IS NULL
    LEFT JOIN routes r ON r.topo_id = t.id AND r.is_published = 1 AND r.deleted_at IS NULL
    WHERE s.crag_id = ?
      AND b.is_published = 1
      AND s.is_published = 1
      AND c.is_published = 1
      AND a.is_published = 1
      AND b.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND a.deleted_at IS NULL
      ${sectorId !== undefined ? "AND b.sector_id = ?" : ""}
    GROUP BY b.id
    ORDER BY b.sort_order, b.id`;

  const params: unknown[] =
    sectorId !== undefined ? [cragId, sectorId] : [cragId];

  return {
    sql,
    params,
    map: (rows) =>
      (rows as BoulderWithStatsRow[]).map((row) => ({
        ...mapBoulder(row),
        routeCount: row.routeCount,
        gradeRange: formatGradeRange(row.minGrade, row.maxGrade),
        hashtagsList: parseHashtags(row.hashtags),
      })),
  };
}

export async function getCragBouldersWithStats(
  cragId: string,
  sectorId?: string
): Promise<
  Array<
    Boulder & {
      routeCount: number;
      gradeRange: string;
      hashtagsList: string[];
    }
  >
> {
  return runQuery(cragBouldersWithStatsQuery(cragId, sectorId));
}

// ---------------------------------------------------------------------------
// 7. Routes for a crag (with hierarchy names)
// ---------------------------------------------------------------------------

export function cragRoutesQuery(cragId: string): D1Query<RouteListItem[]> {
  return {
    sql: `SELECT
       r.id,
       r.topo_id          AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num        AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url   AS lineImageUrl,
       r.is_published     AS isPublished,
       r.sort_order       AS sortOrder,
       b.id               AS boulderId,
       b.name             AS boulderName,
       s.name             AS sectorName,
       c.name             AS cragName,
       c.slug             AS cragSlug,
       s.slug             AS sectorSlug
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE s.crag_id = ?
       AND r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY r.sort_order, r.id`,
    params: [cragId],
    map: (rows) => (rows as RouteListItemRow[]).map(mapRouteListItem),
  };
}

export async function getCragRoutes(
  cragId: string
): Promise<RouteListItem[]> {
  return runQuery(cragRoutesQuery(cragId));
}

/**
 * ALL published routes across every published crag/area, in ONE query.
 * Replaces the loadAllRouteItems double loop (areas × crags requests).
 * Ordered by crag, then route sort_order — callers that need a different
 * ordering should sort in TS.
 */
export function allRouteItemsQuery(): D1Query<RouteListItem[]> {
  return {
    sql: `SELECT
       r.id,
       r.topo_id          AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num        AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url   AS lineImageUrl,
       r.is_published     AS isPublished,
       r.sort_order       AS sortOrder,
       b.id               AS boulderId,
       b.name             AS boulderName,
       s.name             AS sectorName,
       c.name             AS cragName,
       c.slug             AS cragSlug,
       s.slug             AS sectorSlug
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY a.sort_order, a.id, c.sort_order, c.id, r.sort_order, r.id`,
    params: [],
    map: (rows) => (rows as RouteListItemRow[]).map(mapRouteListItem),
  };
}

export async function getAllRouteItemsFlat(): Promise<RouteListItem[]> {
  return runQuery(allRouteItemsQuery());
}

const PUBLIC_SEARCH_LIMIT = 20;

function searchPattern(term: string): string {
  return `%${escapeLikeTerm(term.trim())}%`;
}

export function searchAreasQuery(term: string): D1Query<SearchResults["areas"]> {
  const pattern = searchPattern(term);
  return {
    sql: `SELECT
       a.id,
       a.name,
       a.name_en         AS nameEn,
       a.slug,
       a.cover_image_url AS coverImageUrl,
       a.is_published    AS isPublished,
       a.sort_order      AS sortOrder,
       (SELECT COUNT(*)
        FROM crags c
        WHERE c.area_id = a.id AND c.is_published = 1 AND c.deleted_at IS NULL
       ) AS crags,
       (SELECT COUNT(*)
        FROM sectors s
        JOIN crags c ON c.id = s.crag_id
        WHERE c.area_id = a.id AND s.is_published = 1 AND c.is_published = 1
          AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       ) AS sectors,
       (SELECT COUNT(*)
        FROM boulders b
        JOIN sectors s ON s.id = b.sector_id
        JOIN crags c ON c.id = s.crag_id
        WHERE c.area_id = a.id AND b.is_published = 1 AND s.is_published = 1 AND c.is_published = 1
          AND b.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       ) AS boulders,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        JOIN sectors s ON s.id = b.sector_id
        JOIN crags c ON c.id = s.crag_id
        WHERE c.area_id = a.id
          AND r.is_published = 1 AND t.is_published = 1 AND b.is_published = 1
          AND s.is_published = 1 AND c.is_published = 1
          AND r.deleted_at IS NULL AND t.deleted_at IS NULL AND b.deleted_at IS NULL
          AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       ) AS routes
     FROM areas a
     WHERE a.is_published = 1
       AND a.deleted_at IS NULL
       AND (a.name LIKE ? ESCAPE '\\' OR a.name_en LIKE ? ESCAPE '\\')
     ORDER BY a.sort_order, a.name COLLATE NOCASE
     LIMIT ${PUBLIC_SEARCH_LIMIT}`,
    params: [pattern, pattern],
    map: (rows) =>
      (rows as SearchAreaRow[]).map((row) => ({
        ...mapArea(row),
        stats: {
          crags: row.crags,
          sectors: row.sectors,
          boulders: row.boulders,
          routes: row.routes,
        },
      })),
  };
}

export function searchCragsQuery(term: string): D1Query<SearchResults["crags"]> {
  const pattern = searchPattern(term);
  return {
    sql: `SELECT
       c.id,
       c.area_id         AS areaId,
       c.name,
       c.name_en         AS nameEn,
       c.slug,
       c.lat,
       c.lng,
       c.description,
       c.season,
       c.cover_image_url AS coverImageUrl,
       c.is_published    AS isPublished,
       c.sort_order      AS sortOrder,
       (SELECT COUNT(*)
        FROM sectors s
        WHERE s.crag_id = c.id AND s.is_published = 1 AND s.deleted_at IS NULL
       ) AS sectors,
       (SELECT COUNT(*)
        FROM boulders b
        JOIN sectors s ON s.id = b.sector_id
        WHERE s.crag_id = c.id AND b.is_published = 1 AND s.is_published = 1
          AND b.deleted_at IS NULL AND s.deleted_at IS NULL
       ) AS boulders,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        JOIN sectors s ON s.id = b.sector_id
        WHERE s.crag_id = c.id
          AND r.is_published = 1 AND t.is_published = 1 AND b.is_published = 1 AND s.is_published = 1
          AND r.deleted_at IS NULL AND t.deleted_at IS NULL AND b.deleted_at IS NULL AND s.deleted_at IS NULL
       ) AS routes
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE c.is_published = 1
       AND a.is_published = 1
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
       AND (c.name LIKE ? ESCAPE '\\' OR c.name_en LIKE ? ESCAPE '\\')
     ORDER BY a.sort_order, c.sort_order, c.name COLLATE NOCASE
     LIMIT ${PUBLIC_SEARCH_LIMIT}`,
    params: [pattern, pattern],
    map: (rows) =>
      (rows as SearchCragRow[]).map((row) => ({
        ...mapCrag(row),
        stats: { sectors: row.sectors, boulders: row.boulders, routes: row.routes },
      })),
  };
}

export function searchSectorsQuery(term: string): D1Query<SearchSectorResult[]> {
  const pattern = searchPattern(term);
  return {
    sql: `SELECT
       s.id,
       s.crag_id         AS cragId,
       s.name,
       s.name_en         AS nameEn,
       s.slug,
       s.lat,
       s.lng,
       s.description,
       s.season,
       s.cover_image_url AS coverImageUrl,
       s.is_published    AS isPublished,
       s.sort_order      AS sortOrder,
       c.name            AS cragName,
       c.slug            AS cragSlug,
       (SELECT COUNT(*)
        FROM boulders b
        WHERE b.sector_id = s.id AND b.is_published = 1 AND b.deleted_at IS NULL
       ) AS boulderCount,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        WHERE b.sector_id = s.id
          AND r.is_published = 1 AND t.is_published = 1 AND b.is_published = 1
          AND r.deleted_at IS NULL AND t.deleted_at IS NULL AND b.deleted_at IS NULL
       ) AS routeCount
     FROM sectors s
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
       AND (s.name LIKE ? ESCAPE '\\' OR s.name_en LIKE ? ESCAPE '\\')
     ORDER BY a.sort_order, c.sort_order, s.sort_order, s.name COLLATE NOCASE
     LIMIT ${PUBLIC_SEARCH_LIMIT}`,
    params: [pattern, pattern],
    map: (rows) =>
      (rows as SearchSectorRow[]).map((row) => ({
        ...mapSector(row),
        cragName: row.cragName,
        cragSlug: row.cragSlug,
        boulderCount: row.boulderCount,
        routeCount: row.routeCount,
      })),
  };
}

export function searchBouldersQuery(term: string): D1Query<SearchBoulderResult[]> {
  const pattern = searchPattern(term);
  return {
    sql: `SELECT
       b.id,
       b.sector_id        AS sectorId,
       b.name,
       b.slug,
       b.lat,
       b.lng,
       b.hashtags,
       b.cover_image_url  AS coverImageUrl,
       b.is_published     AS isPublished,
       b.sort_order       AS sortOrder,
       s.name             AS sectorName,
       s.slug             AS sectorSlug,
       c.name             AS cragName,
       c.slug             AS cragSlug,
       COUNT(r.id)        AS routeCount,
       MIN(r.grade_num)   AS minGrade,
       MAX(r.grade_num)   AS maxGrade
     FROM boulders b
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     LEFT JOIN topos t ON t.boulder_id = b.id AND t.is_published = 1 AND t.deleted_at IS NULL
     LEFT JOIN routes r ON r.topo_id = t.id AND r.is_published = 1 AND r.deleted_at IS NULL
     WHERE b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
       AND (b.name LIKE ? ESCAPE '\\' OR b.hashtags LIKE ? ESCAPE '\\')
     GROUP BY b.id
     ORDER BY a.sort_order, c.sort_order, s.sort_order, b.sort_order, b.name COLLATE NOCASE
     LIMIT ${PUBLIC_SEARCH_LIMIT}`,
    params: [pattern, pattern],
    map: (rows) =>
      (rows as SearchBoulderRow[]).map((row) => ({
        ...mapBoulder(row),
        sectorName: row.sectorName,
        sectorSlug: row.sectorSlug,
        cragName: row.cragName,
        cragSlug: row.cragSlug,
        routeCount: row.routeCount,
        gradeRange: formatGradeRange(row.minGrade, row.maxGrade),
        hashtagsList: parseHashtags(row.hashtags),
      })),
  };
}

export function searchRoutesQuery(term: string): D1Query<RouteListItem[]> {
  const pattern = searchPattern(term);
  return {
    sql: `SELECT
       r.id,
       r.topo_id          AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num        AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url   AS lineImageUrl,
       r.is_published     AS isPublished,
       r.sort_order       AS sortOrder,
       b.id               AS boulderId,
       b.name             AS boulderName,
       s.name             AS sectorName,
       c.name             AS cragName,
       c.slug             AS cragSlug,
       s.slug             AS sectorSlug,
       t.base_image_url     AS topoBaseImageUrl
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
       AND r.name LIKE ? ESCAPE '\\'
     ORDER BY a.sort_order, c.sort_order, s.sort_order, b.sort_order, r.sort_order, r.name COLLATE NOCASE
     LIMIT ${PUBLIC_SEARCH_LIMIT}`,
    params: [pattern],
    map: (rows) => (rows as RouteListItemRow[]).map(mapRouteListItem),
  };
}

// ---------------------------------------------------------------------------
// 8. Sector by slug + sector-scoped data
// ---------------------------------------------------------------------------

export function sectorBySlugQuery(
  cragSlug: string,
  sectorSlug: string
): D1Query<Sector | null> {
  return {
    sql: `SELECT
       s.id,
       s.crag_id        AS cragId,
       s.name,
       s.name_en        AS nameEn,
       s.slug,
       s.lat,
       s.lng,
       s.description,
       s.season,
       s.cover_image_url AS coverImageUrl,
       s.is_published    AS isPublished,
       s.sort_order      AS sortOrder
     FROM sectors s
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE c.slug = ?
       AND s.slug = ?
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL`,
    params: [cragSlug, sectorSlug],
    map: (rows) => {
      const row = (rows as SectorRow[])[0];
      return row ? mapSector(row) : null;
    },
  };
}

export async function getSectorBySlug(
  cragSlug: string,
  sectorSlug: string
): Promise<Sector | null> {
  return runQuery(sectorBySlugQuery(cragSlug, sectorSlug));
}

/**
 * Published routes for a single sector (with hierarchy names).
 * Reuses the same join chain; scopes by sector id.
 */
export function sectorRoutesQuery(sectorId: string): D1Query<RouteListItem[]> {
  return {
    sql: `SELECT
       r.id,
       r.topo_id          AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num        AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url   AS lineImageUrl,
       r.is_published     AS isPublished,
       r.sort_order       AS sortOrder,
       b.id               AS boulderId,
       b.name             AS boulderName,
       s.name             AS sectorName,
       c.name             AS cragName,
       c.slug             AS cragSlug,
       s.slug             AS sectorSlug
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE b.sector_id = ?
       AND r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY r.sort_order, r.id`,
    params: [sectorId],
    map: (rows) => (rows as RouteListItemRow[]).map(mapRouteListItem),
  };
}

export async function getSectorRoutes(
  sectorId: string
): Promise<RouteListItem[]> {
  return runQuery(sectorRoutesQuery(sectorId));
}

// ---------------------------------------------------------------------------
// 9. Boulder by id + topos + topo routes
// ---------------------------------------------------------------------------

export function boulderByIdQuery(id: string): D1Query<Boulder | null> {
  return {
    sql: `SELECT
       b.id,
       b.sector_id        AS sectorId,
       b.name,
       b.slug,
       b.lat,
       b.lng,
       b.hashtags,
       b.cover_image_url  AS coverImageUrl,
       b.is_published     AS isPublished,
       b.sort_order       AS sortOrder
     FROM boulders b
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE b.id = ?
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL`,
    params: [id],
    map: (rows) => {
      const row = (rows as BoulderRow[])[0];
      return row ? mapBoulder(row) : null;
    },
  };
}

export async function getBoulderById(id: string): Promise<Boulder | null> {
  return runQuery(boulderByIdQuery(id));
}

/**
 * Published topos for a boulder, ordered by sort_order then id.
 * The repository uses this list to compute topoIndex and topoCount.
 */
export function boulderToposQuery(boulderId: string): D1Query<Topo[]> {
  return {
    sql: `SELECT
       id,
       boulder_id      AS boulderId,
       name,
       base_image_url  AS baseImageUrl,
       is_published    AS isPublished,
       sort_order      AS sortOrder
     FROM topos
     WHERE boulder_id = ?
       AND is_published = 1
       AND deleted_at IS NULL
     ORDER BY sort_order, id`,
    params: [boulderId],
    map: (rows) => (rows as TopoRow[]).map(mapTopo),
  };
}

export async function getBoulderTopos(boulderId: string): Promise<Topo[]> {
  return runQuery(boulderToposQuery(boulderId));
}

/** Published routes for a topo, ordered by sort_order then id. */
export function topoRoutesQuery(topoId: string): D1Query<Route[]> {
  return {
    sql: `SELECT
       id,
       topo_id          AS topoId,
       name,
       slug,
       grade,
       grade_num        AS gradeNum,
       fa,
       description,
       line_image_url   AS lineImageUrl,
       is_published     AS isPublished,
       sort_order       AS sortOrder
     FROM routes
     WHERE topo_id = ?
       AND is_published = 1
       AND deleted_at IS NULL
     ORDER BY sort_order, id`,
    params: [topoId],
    map: (rows) => (rows as RouteRow[]).map(mapRoute),
  };
}

export async function getTopoRoutes(topoId: string): Promise<Route[]> {
  return runQuery(topoRoutesQuery(topoId));
}

/**
 * Published routes for EVERY published topo of a boulder, in ONE query.
 * Ordered by topo (sort_order, id) then route (sort_order, id), so grouping
 * rows by `topoId` preserves the per-topo route order of `getTopoRoutes`.
 * Avoids one HTTP round trip per topo on the boulder detail page.
 */
export function boulderTopoRoutesQuery(boulderId: string): D1Query<Route[]> {
  return {
    sql: `SELECT
       r.id,
       r.topo_id          AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num        AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url   AS lineImageUrl,
       r.is_published     AS isPublished,
       r.sort_order       AS sortOrder
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     WHERE t.boulder_id = ?
       AND t.is_published = 1
       AND r.is_published = 1
       AND t.deleted_at IS NULL
       AND r.deleted_at IS NULL
     ORDER BY t.sort_order, t.id, r.sort_order, r.id`,
    params: [boulderId],
    map: (rows) => (rows as RouteRow[]).map(mapRoute),
  };
}

export async function getBoulderTopoRoutes(boulderId: string): Promise<Route[]> {
  return runQuery(boulderTopoRoutesQuery(boulderId));
}

// ---------------------------------------------------------------------------
// 10. Topo by id (with boulder/sector/crag context)
// ---------------------------------------------------------------------------

/**
 * Returns the topo row joined to its boulder, sector, and crag.
 * topoIndex / topoCount are computed by the repository using `getBoulderTopos`.
 */
export async function getTopoById(id: string): Promise<
  | (Topo & {
      boulder: Boulder;
      sector: Sector;
      crag: Crag;
    })
  | null
> {
  interface TopoDetailRow {
    // topo
    topoId: string;
    topoBoulderId: string;
    topoName: string;
    baseImageUrl: string;
    topoIsPublished: 0 | 1;
    topoSortOrder: number;
    // boulder
    boulderId: string;
    boulderSectorId: string;
    boulderName: string;
    boulderSlug: string;
    boulderLat: number;
    boulderLng: number;
    boulderHashtags: string;
    boulderCoverImageUrl: string;
    boulderIsPublished: 0 | 1;
    boulderSortOrder: number;
    // sector
    sectorId: string;
    sectorCragId: string;
    sectorName: string;
    sectorNameEn: string | null;
    sectorSlug: string;
    sectorLat: number | null;
    sectorLng: number | null;
    sectorDescription: string;
    sectorSeason: string;
    sectorCoverImageUrl: string;
    sectorIsPublished: 0 | 1;
    sectorSortOrder: number;
    // crag
    cragId: string;
    cragAreaId: string;
    cragName: string;
    cragNameEn: string | null;
    cragSlug: string;
    cragLat: number | null;
    cragLng: number | null;
    cragDescription: string;
    cragSeason: string;
    cragCoverImageUrl: string;
    cragIsPublished: 0 | 1;
    cragSortOrder: number;
  }

  const row = await queryD1First<TopoDetailRow>(
    `SELECT
       t.id              AS topoId,
       t.boulder_id      AS topoBoulderId,
       t.name            AS topoName,
       t.base_image_url  AS baseImageUrl,
       t.is_published    AS topoIsPublished,
       t.sort_order      AS topoSortOrder,
       b.id              AS boulderId,
       b.sector_id       AS boulderSectorId,
       b.name            AS boulderName,
       b.slug            AS boulderSlug,
       b.lat             AS boulderLat,
       b.lng             AS boulderLng,
       b.hashtags        AS boulderHashtags,
       b.cover_image_url AS boulderCoverImageUrl,
       b.is_published    AS boulderIsPublished,
       b.sort_order      AS boulderSortOrder,
       s.id              AS sectorId,
       s.crag_id         AS sectorCragId,
       s.name            AS sectorName,
       s.name_en         AS sectorNameEn,
       s.slug            AS sectorSlug,
       s.lat             AS sectorLat,
       s.lng             AS sectorLng,
       s.description     AS sectorDescription,
       s.season          AS sectorSeason,
       s.cover_image_url AS sectorCoverImageUrl,
       s.is_published    AS sectorIsPublished,
       s.sort_order      AS sectorSortOrder,
       c.id              AS cragId,
       c.area_id         AS cragAreaId,
       c.name            AS cragName,
       c.name_en         AS cragNameEn,
       c.slug            AS cragSlug,
       c.lat             AS cragLat,
       c.lng             AS cragLng,
       c.description     AS cragDescription,
       c.season          AS cragSeason,
       c.cover_image_url AS cragCoverImageUrl,
       c.is_published    AS cragIsPublished,
       c.sort_order      AS cragSortOrder
     FROM topos t
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE t.id = ?
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL`,
    [id]
  );

  if (!row) return null;

  const topo: Topo = {
    id: row.topoId,
    boulderId: row.topoBoulderId,
    name: row.topoName,
    baseImageUrl: row.baseImageUrl,
    isPublished: row.topoIsPublished === 1,
    sortOrder: row.topoSortOrder,
  };

  const boulder: Boulder = {
    id: row.boulderId,
    sectorId: row.boulderSectorId,
    name: row.boulderName,
    slug: row.boulderSlug,
    lat: row.boulderLat,
    lng: row.boulderLng,
    hashtags: row.boulderHashtags,
    coverImageUrl: row.boulderCoverImageUrl,
    isPublished: row.boulderIsPublished === 1,
    sortOrder: row.boulderSortOrder,
  };

  const sector: Sector = {
    id: row.sectorId,
    cragId: row.sectorCragId,
    name: row.sectorName,
    nameEn: row.sectorNameEn,
    slug: row.sectorSlug,
    lat: row.sectorLat,
    lng: row.sectorLng,
    description: row.sectorDescription,
    season: row.sectorSeason,
    coverImageUrl: row.sectorCoverImageUrl,
    isPublished: row.sectorIsPublished === 1,
    sortOrder: row.sectorSortOrder,
  };

  const crag: Crag = {
    id: row.cragId,
    areaId: row.cragAreaId,
    name: row.cragName,
    nameEn: row.cragNameEn,
    slug: row.cragSlug,
    lat: row.cragLat,
    lng: row.cragLng,
    description: row.cragDescription,
    season: row.cragSeason,
    coverImageUrl: row.cragCoverImageUrl,
    isPublished: row.cragIsPublished === 1,
    sortOrder: row.cragSortOrder,
  };

  return { ...topo, boulder, sector, crag };
}

// ---------------------------------------------------------------------------
// 11. Area by slug + area-scoped data
// ---------------------------------------------------------------------------

/**
 * Returns a single published, non-soft-deleted Area by its slug.
 * Returns null if the slug does not exist, the area is unpublished, or soft-deleted.
 */
export async function getAreaBySlug(slug: string): Promise<Area | null> {
  const row = await queryD1First<AreaRow>(
    `SELECT
       id,
       name,
       name_en        AS nameEn,
       slug,
       cover_image_url AS coverImageUrl,
       is_published    AS isPublished,
       sort_order      AS sortOrder
     FROM areas
     WHERE slug = ?
       AND is_published = 1
       AND deleted_at IS NULL`,
    [slug]
  );
  return row ? mapArea(row) : null;
}

/**
 * Published-ancestor-aware aggregate stats for a single area.
 * Returns crag/sector/boulder/route counts where the full ancestor chain is
 * published and non-soft-deleted.
 */
export function areaStatsQuery(areaId: string): D1Query<Stats> {
  return {
    sql: `SELECT
       (SELECT COUNT(*)
        FROM crags c
        WHERE c.area_id = ?
          AND c.is_published = 1
          AND c.deleted_at IS NULL
       ) AS crags,
       (SELECT COUNT(*)
        FROM sectors s
        JOIN crags c ON c.id = s.crag_id
        WHERE c.area_id = ?
          AND s.is_published = 1 AND c.is_published = 1
          AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       ) AS sectors,
       (SELECT COUNT(*)
        FROM boulders b
        JOIN sectors s ON s.id = b.sector_id
        JOIN crags c ON c.id = s.crag_id
        WHERE c.area_id = ?
          AND b.is_published = 1 AND s.is_published = 1 AND c.is_published = 1
          AND b.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       ) AS boulders,
       (SELECT COUNT(*)
        FROM routes r
        JOIN topos t ON t.id = r.topo_id
        JOIN boulders b ON b.id = t.boulder_id
        JOIN sectors s ON s.id = b.sector_id
        JOIN crags c ON c.id = s.crag_id
        WHERE c.area_id = ?
          AND r.is_published = 1 AND t.is_published = 1
          AND b.is_published = 1 AND s.is_published = 1 AND c.is_published = 1
          AND r.deleted_at IS NULL AND t.deleted_at IS NULL
          AND b.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       ) AS routes`,
    params: [areaId, areaId, areaId, areaId],
    map: (rows) =>
      (rows as StatsRow[])[0] ?? { crags: 0, sectors: 0, boulders: 0, routes: 0 },
  };
}

export async function getAreaStats(areaId: string): Promise<Stats> {
  return runQuery(areaStatsQuery(areaId));
}

// Grade band definitions — ordered V0-V2, V3-V5, V6-V8, V9-V11, V12+.
const GRADE_BANDS: ReadonlyArray<{ band: string; min: number; max: number }> = [
  { band: "V0-V2", min: 0, max: 2 },
  { band: "V3-V5", min: 3, max: 5 },
  { band: "V6-V8", min: 6, max: 8 },
  { band: "V9-V11", min: 9, max: 11 },
  { band: "V12+", min: 12, max: 99 },
];

interface GradeBandCountRow {
  min: number;
  count: number;
}

/**
 * Returns the grade distribution for a published area.
 * Count is the number of published routes (full ancestor chain published and
 * non-soft-deleted) per grade band.
 * All five bands are always returned (count = 0 when no routes in that range).
 * Topos filtered by t.is_published = 1 AND t.deleted_at IS NULL.
 */
export function areaGradeDistributionQuery(
  areaId: string
): D1Query<GradeBand[]> {
  // Build a CASE expression that maps grade_num to the band's min boundary so
  // we can GROUP BY band without string interpolation.
  // SQLite's CASE is safe here — the values (0, 3, 6, 9, 12) are constants, not user input.
  const caseExpr = `CASE
    WHEN r.grade_num BETWEEN 0 AND 2 THEN 0
    WHEN r.grade_num BETWEEN 3 AND 5 THEN 3
    WHEN r.grade_num BETWEEN 6 AND 8 THEN 6
    WHEN r.grade_num BETWEEN 9 AND 11 THEN 9
    WHEN r.grade_num >= 12 THEN 12
    ELSE NULL
  END`;

  return {
    sql: `SELECT
       ${caseExpr} AS min,
       COUNT(*) AS count
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     WHERE c.area_id = ?
       AND r.is_published = 1
       AND t.is_published = 1
       AND t.deleted_at IS NULL
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND r.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
     GROUP BY min
     HAVING min IS NOT NULL`,
    params: [areaId],
    map: (rows) => {
      // Build a lookup from band-min → count, then map to ordered output.
      const countByMin = new Map<number, number>();
      for (const row of rows as GradeBandCountRow[]) {
        countByMin.set(row.min, row.count);
      }

      return GRADE_BANDS.map((b) => ({
        band: b.band,
        min: b.min,
        max: b.max,
        count: countByMin.get(b.min) ?? 0,
      }));
    },
  };
}

export async function getAreaGradeDistribution(
  areaId: string
): Promise<GradeBand[]> {
  return runQuery(areaGradeDistributionQuery(areaId));
}

/**
 * Per-crag grade distribution for every published route across all crags.
 * Returns `cragId -> { gradeNum -> count }` rows; callers bucket into V-grade
 * labels using `lib/grade-histogram.ts`.
 */
export function allCragGradeCountsQuery(): D1Query<
  Array<{ cragId: string; gradeNum: number; count: number }>
> {
  return {
    sql: `SELECT s.crag_id AS cragId, r.grade_num AS gradeNum, COUNT(*) AS count
       FROM routes r
       JOIN topos t ON t.id = r.topo_id
       JOIN boulders b ON b.id = t.boulder_id
       JOIN sectors s ON s.id = b.sector_id
       JOIN crags c ON c.id = s.crag_id
      WHERE r.is_published = 1
        AND t.is_published = 1
        AND b.is_published = 1
        AND s.is_published = 1
        AND c.is_published = 1
        AND r.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND c.deleted_at IS NULL
      GROUP BY s.crag_id, r.grade_num`,
    params: [],
    map: (rows) =>
      rows as Array<{ cragId: string; gradeNum: number; count: number }>,
  };
}

export async function getAllCragGradeCounts(): Promise<
  Array<{ cragId: string; gradeNum: number; count: number }>
> {
  return runQuery(allCragGradeCountsQuery());
}

// ---------------------------------------------------------------------------
// 12. Area crags with coordinates (for overview map)
// ---------------------------------------------------------------------------

/**
 * Published Crags within an Area that have non-null coordinates.
 * Used by the Area overview map. Excludes Crags without lat/lng (they'd render at (0,0)).
 * Ancestor published check: area must also be published and non-soft-deleted.
 */
export function areaCragsWithCoordsQuery(
  areaId: string
): D1Query<CragLocation[]> {
  return {
    sql: `SELECT c.id, c.slug, c.name, c.lat AS lat, c.lng AS lng
       FROM crags c
       JOIN areas a ON a.id = c.area_id
      WHERE c.area_id = ?
        AND c.is_published = 1 AND c.deleted_at IS NULL
        AND a.is_published = 1 AND a.deleted_at IS NULL
        AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY c.sort_order ASC, c.id ASC`,
    params: [areaId],
    map: (rows) => rows as CragLocation[],
  };
}

export async function getAreaCragsWithCoords(areaId: string): Promise<CragLocation[]> {
  return runQuery(areaCragsWithCoordsQuery(areaId));
}

// ---------------------------------------------------------------------------
// 13. Route by id
// ---------------------------------------------------------------------------

export async function getRouteById(id: string): Promise<RouteListItem | null> {
  const row = await queryD1First<RouteListItemRow>(
    `SELECT
       r.id,
       r.topo_id          AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num        AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url   AS lineImageUrl,
       r.is_published     AS isPublished,
       r.sort_order       AS sortOrder,
       b.id               AS boulderId,
       b.name             AS boulderName,
       s.name             AS sectorName,
       c.name             AS cragName,
       c.slug             AS cragSlug,
       s.slug             AS sectorSlug
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.id = ?
       AND r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL`,
    [id]
  );
  return row ? mapRouteListItem(row) : null;
}
