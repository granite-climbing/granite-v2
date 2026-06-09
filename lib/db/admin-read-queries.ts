/**
 * Admin read queries for Cloudflare D1.
 *
 * Admin reads INCLUDE unpublished rows (is_published = 0) and soft-deleted
 * rows (deleted_at IS NOT NULL) so the admin UI can display drafts and
 * offer restore-deleted actions.
 *
 * Exception: we exclude rows whose PARENT is deleted, because those would be
 * orphaned data that the admin cannot usefully act on from the child list.
 * (e.g. crags whose parent area is deleted are hidden from the crag list;
 * the admin must first restore the area to see its crags.)
 *
 * Each row shape includes `isPublished` (boolean) and `deletedAt` (string|null)
 * so the UI can label rows accordingly.
 */

import { queryD1, queryD1First } from "./d1-http";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type AdminEntityCounts = {
  published: number;
  draft: number;
  deleted: number;
  total: number;
};

export type AdminContentOverview = {
  areas: AdminEntityCounts;
  crags: AdminEntityCounts;
  sectors: AdminEntityCounts;
  boulders: AdminEntityCounts;
  topos: AdminEntityCounts;
  routes: AdminEntityCounts;
  announcements: AdminEntityCounts;
};

export type AdminAreaRow = {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  deletedAt: string | null;
};

export type AdminCragRow = {
  id: string;
  areaId: string;
  areaName: string;
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
  deletedAt: string | null;
};

export type AdminSectorRow = {
  id: string;
  cragId: string;
  cragName: string;
  cragSlug: string;
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
  deletedAt: string | null;
};

export type AdminBoulderRow = {
  id: string;
  sectorId: string;
  sectorName: string;
  sectorSlug: string;
  cragName: string;
  cragSlug: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  hashtags: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  deletedAt: string | null;
};

export type AdminTopoRow = {
  id: string;
  boulderId: string;
  boulderName: string;
  boulderSlug: string;
  cragSlug: string;
  name: string;
  baseImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  deletedAt: string | null;
};

export type AdminRouteRow = {
  id: string;
  topoId: string;
  topoName: string;
  boulderId: string;
  boulderName: string;
  boulderSlug: string;
  cragSlug: string;
  name: string;
  slug: string;
  grade: string;
  gradeNum: number;
  fa: string;
  description: string;
  lineImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  deletedAt: string | null;
};

export type AdminAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string;
  cragId: string | null;
  linkUrl: string;
  isPublished: boolean;
  publishedAt: string;
  sortOrder: number;
  deletedAt: string | null;
};

export type AdminAuditLog = {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// SQL-layer row types (is_published as 0|1)
// ---------------------------------------------------------------------------

interface OverviewSqlRow {
  areasPublished: number;
  areasDraft: number;
  areasDeleted: number;
  cragsPublished: number;
  cragsDraft: number;
  cragsDeleted: number;
  sectorsPublished: number;
  sectorsDraft: number;
  sectorsDeleted: number;
  bouldersPublished: number;
  bouldersDraft: number;
  bouldersDeleted: number;
  toposPublished: number;
  toposDraft: number;
  toposDeleted: number;
  routesPublished: number;
  routesDraft: number;
  routesDeleted: number;
  announcementsPublished: number;
  announcementsDraft: number;
  announcementsDeleted: number;
}

interface AdminAreaSqlRow {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  coverImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
  deletedAt: string | null;
}

interface AdminCragSqlRow {
  id: string;
  areaId: string;
  areaName: string;
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
  deletedAt: string | null;
}

interface AdminSectorSqlRow {
  id: string;
  cragId: string;
  cragName: string;
  cragSlug: string;
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
  deletedAt: string | null;
}

interface AdminBoulderSqlRow {
  id: string;
  sectorId: string;
  sectorName: string;
  sectorSlug: string;
  cragName: string;
  cragSlug: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  hashtags: string;
  coverImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
  deletedAt: string | null;
}

interface AdminTopoSqlRow {
  id: string;
  boulderId: string;
  boulderName: string;
  boulderSlug: string;
  cragSlug: string;
  name: string;
  baseImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
  deletedAt: string | null;
}

interface AdminRouteSqlRow {
  id: string;
  topoId: string;
  topoName: string;
  boulderId: string;
  boulderName: string;
  boulderSlug: string;
  cragSlug: string;
  name: string;
  slug: string;
  grade: string;
  gradeNum: number;
  fa: string;
  description: string;
  lineImageUrl: string;
  isPublished: 0 | 1;
  sortOrder: number;
  deletedAt: string | null;
}

interface AdminAnnouncementSqlRow {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string;
  cragId: string | null;
  linkUrl: string;
  isPublished: 0 | 1;
  publishedAt: string;
  sortOrder: number;
  deletedAt: string | null;
}

interface AdminAuditLogSqlRow {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCounts(published: number, draft: number, deleted: number): AdminEntityCounts {
  return { published, draft, deleted, total: published + draft + deleted };
}

function zeroOverview(): AdminContentOverview {
  const zero = toCounts(0, 0, 0);
  return {
    areas: { ...zero },
    crags: { ...zero },
    sectors: { ...zero },
    boulders: { ...zero },
    topos: { ...zero },
    routes: { ...zero },
    announcements: { ...zero },
  };
}

// ---------------------------------------------------------------------------
// 1. Content overview — counts per entity
// ---------------------------------------------------------------------------

/**
 * Returns published / draft / deleted counts for every content entity.
 * A row is:
 *   - deleted   when deleted_at IS NOT NULL
 *   - published when deleted_at IS NULL AND is_published = 1
 *   - draft     when deleted_at IS NULL AND is_published = 0
 */
export async function getAdminContentOverview(): Promise<AdminContentOverview> {
  const row = await queryD1First<OverviewSqlRow>(
    `SELECT
       -- areas
       (SELECT COUNT(*) FROM areas WHERE deleted_at IS NULL AND is_published = 1)  AS areasPublished,
       (SELECT COUNT(*) FROM areas WHERE deleted_at IS NULL AND is_published = 0)  AS areasDraft,
       (SELECT COUNT(*) FROM areas WHERE deleted_at IS NOT NULL)                    AS areasDeleted,
       -- crags
       (SELECT COUNT(*) FROM crags WHERE deleted_at IS NULL AND is_published = 1)  AS cragsPublished,
       (SELECT COUNT(*) FROM crags WHERE deleted_at IS NULL AND is_published = 0)  AS cragsDraft,
       (SELECT COUNT(*) FROM crags WHERE deleted_at IS NOT NULL)                    AS cragsDeleted,
       -- sectors
       (SELECT COUNT(*) FROM sectors WHERE deleted_at IS NULL AND is_published = 1) AS sectorsPublished,
       (SELECT COUNT(*) FROM sectors WHERE deleted_at IS NULL AND is_published = 0) AS sectorsDraft,
       (SELECT COUNT(*) FROM sectors WHERE deleted_at IS NOT NULL)                  AS sectorsDeleted,
       -- boulders
       (SELECT COUNT(*) FROM boulders WHERE deleted_at IS NULL AND is_published = 1) AS bouldersPublished,
       (SELECT COUNT(*) FROM boulders WHERE deleted_at IS NULL AND is_published = 0) AS bouldersDraft,
       (SELECT COUNT(*) FROM boulders WHERE deleted_at IS NOT NULL)                  AS bouldersDeleted,
       -- topos
       (SELECT COUNT(*) FROM topos WHERE deleted_at IS NULL AND is_published = 1)   AS toposPublished,
       (SELECT COUNT(*) FROM topos WHERE deleted_at IS NULL AND is_published = 0)   AS toposDraft,
       (SELECT COUNT(*) FROM topos WHERE deleted_at IS NOT NULL)                    AS toposDeleted,
       -- routes
       (SELECT COUNT(*) FROM routes WHERE deleted_at IS NULL AND is_published = 1)  AS routesPublished,
       (SELECT COUNT(*) FROM routes WHERE deleted_at IS NULL AND is_published = 0)  AS routesDraft,
       (SELECT COUNT(*) FROM routes WHERE deleted_at IS NOT NULL)                   AS routesDeleted,
       -- announcements
       (SELECT COUNT(*) FROM announcements WHERE deleted_at IS NULL AND is_published = 1) AS announcementsPublished,
       (SELECT COUNT(*) FROM announcements WHERE deleted_at IS NULL AND is_published = 0) AS announcementsDraft,
       (SELECT COUNT(*) FROM announcements WHERE deleted_at IS NOT NULL)                  AS announcementsDeleted`
  );

  if (!row) return zeroOverview();

  return {
    areas: toCounts(row.areasPublished, row.areasDraft, row.areasDeleted),
    crags: toCounts(row.cragsPublished, row.cragsDraft, row.cragsDeleted),
    sectors: toCounts(row.sectorsPublished, row.sectorsDraft, row.sectorsDeleted),
    boulders: toCounts(row.bouldersPublished, row.bouldersDraft, row.bouldersDeleted),
    topos: toCounts(row.toposPublished, row.toposDraft, row.toposDeleted),
    routes: toCounts(row.routesPublished, row.routesDraft, row.routesDeleted),
    announcements: toCounts(row.announcementsPublished, row.announcementsDraft, row.announcementsDeleted),
  };
}

// ---------------------------------------------------------------------------
// 2. Areas
// ---------------------------------------------------------------------------

/** All areas — including drafts and self-deleted. No parent to filter. */
export async function getAdminAreas(): Promise<AdminAreaRow[]> {
  const rows = await queryD1<AdminAreaSqlRow>(
    `SELECT
       id,
       name,
       name_en         AS nameEn,
       slug,
       cover_image_url AS coverImageUrl,
       is_published    AS isPublished,
       sort_order      AS sortOrder,
       deleted_at      AS deletedAt
     FROM areas
     ORDER BY sort_order ASC, name ASC`
  );
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// Filter option types
// ---------------------------------------------------------------------------

export type ParentOption = { id: string; name: string };

// ---------------------------------------------------------------------------
// 3. Crags
// ---------------------------------------------------------------------------

export type CragFilters = { areaId?: string };

/**
 * All crags — including drafts and self-deleted.
 * Excludes crags whose parent area is deleted (orphaned data).
 * Optionally scoped by areaId.
 */
export async function getAdminCrags(filters?: CragFilters): Promise<AdminCragRow[]> {
  const conditions: string[] = ["a.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (filters?.areaId) {
    conditions.push("c.area_id = ?");
    params.push(filters.areaId);
  }

  const where = conditions.join(" AND ");
  const sql = `SELECT
       c.id,
       c.area_id        AS areaId,
       a.name           AS areaName,
       c.name,
       c.name_en        AS nameEn,
       c.slug,
       c.lat,
       c.lng,
       c.description,
       c.season,
       c.cover_image_url AS coverImageUrl,
       c.is_published    AS isPublished,
       c.sort_order      AS sortOrder,
       c.deleted_at      AS deletedAt
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE ${where}
     ORDER BY a.sort_order ASC, c.sort_order ASC, c.name ASC`;

  const rows = await queryD1<AdminCragSqlRow>(sql, params.length > 0 ? params : undefined);
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// 4. Sectors
// ---------------------------------------------------------------------------

export type SectorFilters = { areaId?: string; cragId?: string };

/**
 * All sectors — including drafts and self-deleted.
 * Excludes sectors whose parent crag or area is deleted.
 * Optionally scoped by areaId and/or cragId (conjunctive AND).
 */
export async function getAdminSectors(filters?: SectorFilters | string): Promise<AdminSectorRow[]> {
  // Support legacy string signature (cragId positional arg) for backwards compat
  const normalised: SectorFilters =
    typeof filters === "string" ? { cragId: filters } : (filters ?? {});

  const conditions: string[] = ["c.deleted_at IS NULL", "a.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (normalised.areaId) {
    conditions.push("c.area_id = ?");
    params.push(normalised.areaId);
  }
  if (normalised.cragId) {
    conditions.push("s.crag_id = ?");
    params.push(normalised.cragId);
  }

  const where = conditions.join(" AND ");
  const sql = `SELECT
       s.id,
       s.crag_id        AS cragId,
       c.name           AS cragName,
       c.slug           AS cragSlug,
       s.name,
       s.name_en        AS nameEn,
       s.slug,
       s.lat,
       s.lng,
       s.description,
       s.season,
       s.cover_image_url AS coverImageUrl,
       s.is_published    AS isPublished,
       s.sort_order      AS sortOrder,
       s.deleted_at      AS deletedAt
     FROM sectors s
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE ${where}
     ORDER BY a.sort_order ASC, c.sort_order ASC, s.sort_order ASC, s.name ASC`;

  const rows = await queryD1<AdminSectorSqlRow>(sql, params.length > 0 ? params : undefined);
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// 5. Boulders
// ---------------------------------------------------------------------------

export type BoulderFilters = { areaId?: string; cragId?: string; sectorId?: string };

/**
 * All boulders — including drafts and self-deleted.
 * Excludes boulders whose parent sector, crag, or area is deleted.
 * Optionally scoped by areaId, cragId, and/or sectorId (conjunctive AND).
 */
export async function getAdminBoulders(filters?: BoulderFilters | string): Promise<AdminBoulderRow[]> {
  // Support legacy string signature (sectorId positional arg) for backwards compat
  const normalised: BoulderFilters =
    typeof filters === "string" ? { sectorId: filters } : (filters ?? {});

  const conditions: string[] = [
    "s.deleted_at IS NULL",
    "c.deleted_at IS NULL",
    "a.deleted_at IS NULL",
  ];
  const params: unknown[] = [];

  if (normalised.areaId) {
    conditions.push("c.area_id = ?");
    params.push(normalised.areaId);
  }
  if (normalised.cragId) {
    conditions.push("s.crag_id = ?");
    params.push(normalised.cragId);
  }
  if (normalised.sectorId) {
    conditions.push("b.sector_id = ?");
    params.push(normalised.sectorId);
  }

  const where = conditions.join(" AND ");
  const sql = `SELECT
       b.id,
       b.sector_id       AS sectorId,
       s.name            AS sectorName,
       s.slug            AS sectorSlug,
       c.name            AS cragName,
       c.slug            AS cragSlug,
       b.name,
       b.slug,
       b.lat,
       b.lng,
       b.hashtags,
       b.cover_image_url AS coverImageUrl,
       b.is_published    AS isPublished,
       b.sort_order      AS sortOrder,
       b.deleted_at      AS deletedAt
     FROM boulders b
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE ${where}
     ORDER BY a.sort_order ASC, c.sort_order ASC, s.sort_order ASC, b.sort_order ASC, b.name ASC`;

  const rows = await queryD1<AdminBoulderSqlRow>(sql, params.length > 0 ? params : undefined);
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// 6. Topos
// ---------------------------------------------------------------------------

export type TopoFilters = { areaId?: string; cragId?: string; sectorId?: string; boulderId?: string };

/**
 * All topos — including drafts and self-deleted.
 * Excludes topos whose parent boulder, sector, crag, or area is deleted.
 * Optionally scoped by areaId, cragId, sectorId, and/or boulderId (conjunctive AND).
 */
export async function getAdminTopos(filters?: TopoFilters | string): Promise<AdminTopoRow[]> {
  // Support legacy string signature (boulderId positional arg) for backwards compat
  const normalised: TopoFilters =
    typeof filters === "string" ? { boulderId: filters } : (filters ?? {});

  const conditions: string[] = [
    "b.deleted_at IS NULL",
    "s.deleted_at IS NULL",
    "c.deleted_at IS NULL",
    "a.deleted_at IS NULL",
  ];
  const params: unknown[] = [];

  if (normalised.areaId) {
    conditions.push("c.area_id = ?");
    params.push(normalised.areaId);
  }
  if (normalised.cragId) {
    conditions.push("s.crag_id = ?");
    params.push(normalised.cragId);
  }
  if (normalised.sectorId) {
    conditions.push("b.sector_id = ?");
    params.push(normalised.sectorId);
  }
  if (normalised.boulderId) {
    conditions.push("t.boulder_id = ?");
    params.push(normalised.boulderId);
  }

  const where = conditions.join(" AND ");
  const sql = `SELECT
       t.id,
       t.boulder_id     AS boulderId,
       b.name           AS boulderName,
       b.slug           AS boulderSlug,
       c.slug           AS cragSlug,
       t.name,
       t.base_image_url AS baseImageUrl,
       t.is_published   AS isPublished,
       t.sort_order     AS sortOrder,
       t.deleted_at     AS deletedAt
     FROM topos t
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE ${where}
     ORDER BY a.sort_order ASC, c.sort_order ASC, s.sort_order ASC, b.sort_order ASC, t.sort_order ASC, t.name ASC`;

  const rows = await queryD1<AdminTopoSqlRow>(sql, params.length > 0 ? params : undefined);
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// 7. Routes
// ---------------------------------------------------------------------------

export type RouteFilters = {
  areaId?: string;
  cragId?: string;
  sectorId?: string;
  boulderId?: string;
  topoId?: string;
};

/**
 * All routes — including drafts and self-deleted.
 * Excludes routes whose parent topo, boulder, sector, crag, or area is deleted.
 * Optionally scoped by any combination of parent IDs (conjunctive AND).
 */
export async function getAdminRoutes(filters?: RouteFilters | string): Promise<AdminRouteRow[]> {
  // Support legacy string signature (topoId positional arg) for backwards compat
  const normalised: RouteFilters =
    typeof filters === "string" ? { topoId: filters } : (filters ?? {});

  const conditions: string[] = [
    "t.deleted_at IS NULL",
    "b.deleted_at IS NULL",
    "s.deleted_at IS NULL",
    "c.deleted_at IS NULL",
    "a.deleted_at IS NULL",
  ];
  const params: unknown[] = [];

  if (normalised.areaId) {
    conditions.push("c.area_id = ?");
    params.push(normalised.areaId);
  }
  if (normalised.cragId) {
    conditions.push("s.crag_id = ?");
    params.push(normalised.cragId);
  }
  if (normalised.sectorId) {
    conditions.push("b.sector_id = ?");
    params.push(normalised.sectorId);
  }
  if (normalised.boulderId) {
    conditions.push("t.boulder_id = ?");
    params.push(normalised.boulderId);
  }
  if (normalised.topoId) {
    conditions.push("r.topo_id = ?");
    params.push(normalised.topoId);
  }

  const where = conditions.join(" AND ");
  const sql = `SELECT
       r.id,
       r.topo_id        AS topoId,
       t.name           AS topoName,
       b.id             AS boulderId,
       b.name           AS boulderName,
       b.slug           AS boulderSlug,
       c.slug           AS cragSlug,
       r.name,
       r.slug,
       r.grade,
       r.grade_num      AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url AS lineImageUrl,
       r.is_published   AS isPublished,
       r.sort_order     AS sortOrder,
       r.deleted_at     AS deletedAt
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE ${where}
     ORDER BY a.sort_order ASC, c.sort_order ASC, s.sort_order ASC, b.sort_order ASC, t.sort_order ASC, r.sort_order ASC, r.name ASC`;

  const rows = await queryD1<AdminRouteSqlRow>(sql, params.length > 0 ? params : undefined);
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

/**
 * Published routes only — all ancestor hierarchy must also be published and non-deleted.
 * Used for the admin webhooks manual-match dropdown so operators cannot attach Betas to
 * draft or deleted content.
 */
export async function getPublishedAdminRoutes(): Promise<AdminRouteRow[]> {
  const rows = await queryD1<AdminRouteSqlRow>(
    `SELECT
       r.id,
       r.topo_id        AS topoId,
       t.name           AS topoName,
       b.id             AS boulderId,
       b.name           AS boulderName,
       b.slug           AS boulderSlug,
       c.slug           AS cragSlug,
       r.name,
       r.slug,
       r.grade,
       r.grade_num      AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url AS lineImageUrl,
       r.is_published   AS isPublished,
       r.sort_order     AS sortOrder,
       r.deleted_at     AS deletedAt
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.is_published = 1 AND t.is_published = 1 AND b.is_published = 1
       AND s.is_published = 1 AND c.is_published = 1 AND a.is_published = 1
       AND r.deleted_at IS NULL AND t.deleted_at IS NULL AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND a.deleted_at IS NULL
     ORDER BY c.name ASC, b.name ASC, r.sort_order ASC, r.name ASC`,
    []
  );
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// Option-list queries (for parent filter dropdowns)
// Excludes soft-deleted rows. Returns { id, name }[] sorted by sort_order ASC, name ASC.
// ---------------------------------------------------------------------------

interface OptionSqlRow {
  id: string;
  name: string;
}

/** All non-deleted areas as select options. */
export async function listAreaOptions(): Promise<ParentOption[]> {
  return queryD1<OptionSqlRow>(
    `SELECT id, name FROM areas WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
  );
}

/** Non-deleted crags, optionally scoped to a given area. */
export async function listCragOptionsByArea(areaId?: string): Promise<ParentOption[]> {
  const conditions = ["c.deleted_at IS NULL", "a.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (areaId) {
    conditions.push("c.area_id = ?");
    params.push(areaId);
  }
  return queryD1<OptionSqlRow>(
    `SELECT c.id, c.name
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.sort_order ASC, c.name ASC`,
    params.length > 0 ? params : undefined
  );
}

/** Non-deleted sectors, optionally scoped to a given crag. */
export async function listSectorOptionsByCrag(cragId?: string): Promise<ParentOption[]> {
  const conditions = ["s.deleted_at IS NULL", "c.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (cragId) {
    conditions.push("s.crag_id = ?");
    params.push(cragId);
  }
  return queryD1<OptionSqlRow>(
    `SELECT s.id, s.name
     FROM sectors s
     JOIN crags c ON c.id = s.crag_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.sort_order ASC, s.name ASC`,
    params.length > 0 ? params : undefined
  );
}

/** Non-deleted boulders, optionally scoped to a given sector. */
export async function listBoulderOptionsBySector(sectorId?: string): Promise<ParentOption[]> {
  const conditions = ["b.deleted_at IS NULL", "s.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (sectorId) {
    conditions.push("b.sector_id = ?");
    params.push(sectorId);
  }
  return queryD1<OptionSqlRow>(
    `SELECT b.id, b.name
     FROM boulders b
     JOIN sectors s ON s.id = b.sector_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY b.sort_order ASC, b.name ASC`,
    params.length > 0 ? params : undefined
  );
}

/** Non-deleted topos, optionally scoped to a given boulder. */
export async function listTopoOptionsByBoulder(boulderId?: string): Promise<ParentOption[]> {
  const conditions = ["t.deleted_at IS NULL", "b.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (boulderId) {
    conditions.push("t.boulder_id = ?");
    params.push(boulderId);
  }
  return queryD1<OptionSqlRow>(
    `SELECT t.id, t.name
     FROM topos t
     JOIN boulders b ON b.id = t.boulder_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.sort_order ASC, t.name ASC`,
    params.length > 0 ? params : undefined
  );
}

// ---------------------------------------------------------------------------
// 8. Announcements
// ---------------------------------------------------------------------------

/** All announcements — including drafts and deleted. */
export async function getAdminAnnouncements(): Promise<AdminAnnouncementRow[]> {
  const rows = await queryD1<AdminAnnouncementSqlRow>(
    `SELECT
       id,
       title,
       body,
       cover_image_url AS coverImageUrl,
       crag_id         AS cragId,
       link_url        AS linkUrl,
       is_published    AS isPublished,
       published_at    AS publishedAt,
       sort_order      AS sortOrder,
       deleted_at      AS deletedAt
     FROM announcements
     ORDER BY sort_order ASC, id ASC`
  );
  return rows.map((r) => ({ ...r, isPublished: r.isPublished === 1 }));
}

// ---------------------------------------------------------------------------
// 9. Audit logs
// ---------------------------------------------------------------------------

/**
 * Returns recent admin audit logs, ordered by creation time descending.
 * Includes admin email via JOIN with admins table.
 */
export async function getRecentAdminAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
  const rows = await queryD1<AdminAuditLogSqlRow>(
    `SELECT
       l.id,
       l.admin_id        AS adminId,
       a.email           AS adminEmail,
       l.action,
       l.target_type     AS targetType,
       l.target_id       AS targetId,
       l.metadata,
       l.created_at      AS createdAt
     FROM admin_audit_logs l
     JOIN admins a ON a.id = l.admin_id
     ORDER BY l.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}
