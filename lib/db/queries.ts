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
 *    `getCragStats(cragId)`. This file exposes `getCragStats` as a helper.
 */

import { queryD1, queryD1First } from "./d1-http";
import type {
  Announcement,
  Area,
  Boulder,
  Crag,
  CragLocation,
  GradeBand,
  RouteListItem,
  Route,
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
export async function getStats(): Promise<Stats> {
  const row = await queryD1First<StatsRow>(
    `SELECT
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
       ) AS routes`
  );

  return row ?? { crags: 0, sectors: 0, boulders: 0, routes: 0 };
}

// ---------------------------------------------------------------------------
// 2. Areas + crags
// ---------------------------------------------------------------------------

/** Published areas ordered by sort_order, then id. */
export async function getPublishedAreas(): Promise<Area[]> {
  const rows = await queryD1<AreaRow>(
    `SELECT
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
     ORDER BY sort_order, id`
  );
  return rows.map(mapArea);
}

/**
 * All published, non-soft-deleted crags whose parent area is also published
 * and non-soft-deleted. Returns a flat list ordered by sort_order ASC, then
 * name ASC. Used by the home page all-Crags slider.
 */
export async function getAllPublishedCrags(): Promise<Crag[]> {
  const rows = await queryD1<CragRow>(
    `SELECT
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
     ORDER BY c.sort_order ASC, c.name ASC`
  );
  return rows.map(mapCrag);
}

/**
 * Published crags for a given area, ordered by sort_order then id.
 * Used by the repository's Area detail loader (`loadAreaBySlug`) and by
 * `loadAllRouteItems`. The home model uses `getAllPublishedCrags` instead.
 */
export async function getCragsByAreaId(areaId: string): Promise<Crag[]> {
  const rows = await queryD1<CragRow>(
    `SELECT
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
    [areaId]
  );
  return rows.map(mapCrag);
}

/**
 * Published-ancestor-aware stats for a single crag.
 * Returns sector/boulder/route counts. Used by the repository to build
 * per-crag stats in HomeModel and CragDetail.
 */
export async function getCragStats(
  cragId: string
): Promise<Omit<Stats, "crags">> {
  const row = await queryD1First<{
    sectors: number;
    boulders: number;
    routes: number;
  }>(
    `SELECT
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
    [cragId, cragId, cragId]
  );
  return row ?? { sectors: 0, boulders: 0, routes: 0 };
}

// ---------------------------------------------------------------------------
// 3. Announcements
// ---------------------------------------------------------------------------

export async function getPublishedAnnouncements(): Promise<Announcement[]> {
  const rows = await queryD1<AnnouncementRow>(
    `SELECT
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
     ORDER BY sort_order, id`
  );
  return rows.map(mapAnnouncement);
}

// ---------------------------------------------------------------------------
// 4. Crag by slug
// ---------------------------------------------------------------------------

export async function getCragBySlug(slug: string): Promise<Crag | null> {
  const row = await queryD1First<CragRow>(
    `SELECT
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
    [slug]
  );
  return row ? mapCrag(row) : null;
}

// ---------------------------------------------------------------------------
// 5. Sectors for a crag
// ---------------------------------------------------------------------------

export async function getCragSectors(cragId: string): Promise<Sector[]> {
  const rows = await queryD1<SectorRow>(
    `SELECT
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
    [cragId]
  );
  return rows.map(mapSector);
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

  const rows = await queryD1<BoulderWithStatsRow>(sql, params);

  return rows.map((row) => ({
    ...mapBoulder(row),
    routeCount: row.routeCount,
    gradeRange: formatGradeRange(row.minGrade, row.maxGrade),
    hashtagsList: parseHashtags(row.hashtags),
  }));
}

// ---------------------------------------------------------------------------
// 7. Routes for a crag (with hierarchy names)
// ---------------------------------------------------------------------------

export async function getCragRoutes(
  cragId: string
): Promise<RouteListItem[]> {
  const rows = await queryD1<RouteListItemRow>(
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
    [cragId]
  );
  return rows.map(mapRouteListItem);
}

// ---------------------------------------------------------------------------
// 8. Sector by slug + sector-scoped data
// ---------------------------------------------------------------------------

export async function getSectorBySlug(
  cragSlug: string,
  sectorSlug: string
): Promise<Sector | null> {
  const row = await queryD1First<SectorRow>(
    `SELECT
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
    [cragSlug, sectorSlug]
  );
  return row ? mapSector(row) : null;
}

/**
 * Published routes for a single sector (with hierarchy names).
 * Reuses the same join chain; scopes by sector id.
 */
export async function getSectorRoutes(
  sectorId: string
): Promise<RouteListItem[]> {
  const rows = await queryD1<RouteListItemRow>(
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
    [sectorId]
  );
  return rows.map(mapRouteListItem);
}

// ---------------------------------------------------------------------------
// 9. Boulder by id + topos + topo routes
// ---------------------------------------------------------------------------

export async function getBoulderById(id: string): Promise<Boulder | null> {
  const row = await queryD1First<BoulderRow>(
    `SELECT
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
    [id]
  );
  return row ? mapBoulder(row) : null;
}

/**
 * Published topos for a boulder, ordered by sort_order then id.
 * The repository uses this list to compute topoIndex and topoCount.
 */
export async function getBoulderTopos(boulderId: string): Promise<Topo[]> {
  const rows = await queryD1<TopoRow>(
    `SELECT
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
    [boulderId]
  );
  return rows.map(mapTopo);
}

/** Published routes for a topo, ordered by sort_order then id. */
export async function getTopoRoutes(topoId: string): Promise<Route[]> {
  const rows = await queryD1<RouteRow>(
    `SELECT
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
    [topoId]
  );
  return rows.map(mapRoute);
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
export async function getAreaStats(areaId: string): Promise<Stats> {
  const row = await queryD1First<StatsRow>(
    `SELECT
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
    [areaId, areaId, areaId, areaId]
  );
  return row ?? { crags: 0, sectors: 0, boulders: 0, routes: 0 };
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
export async function getAreaGradeDistribution(
  areaId: string
): Promise<GradeBand[]> {
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

  const rows = await queryD1<GradeBandCountRow>(
    `SELECT
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
    [areaId]
  );

  // Build a lookup from band-min → count, then map to ordered output.
  const countByMin = new Map<number, number>();
  for (const row of rows) {
    countByMin.set(row.min, row.count);
  }

  return GRADE_BANDS.map((b) => ({
    band: b.band,
    min: b.min,
    max: b.max,
    count: countByMin.get(b.min) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// 12. Area crags with coordinates (for overview map)
// ---------------------------------------------------------------------------

/**
 * Published Crags within an Area that have non-null coordinates.
 * Used by the Area overview map. Excludes Crags without lat/lng (they'd render at (0,0)).
 * Ancestor published check: area must also be published and non-soft-deleted.
 */
export async function getAreaCragsWithCoords(areaId: string): Promise<CragLocation[]> {
  const rows = await queryD1<CragLocation>(
    `SELECT c.id, c.slug, c.name, c.lat AS lat, c.lng AS lng
       FROM crags c
       JOIN areas a ON a.id = c.area_id
      WHERE c.area_id = ?
        AND c.is_published = 1 AND c.deleted_at IS NULL
        AND a.is_published = 1 AND a.deleted_at IS NULL
        AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY c.sort_order ASC, c.id ASC`,
    [areaId]
  );
  return rows;
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
