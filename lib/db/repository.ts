import { unstable_cache } from "next/cache";
import {
  allCragGradeCountsQuery,
  allCragStatsQuery,
  allPublishedCragsQuery,
  areaCragsWithCoordsQuery,
  areaGradeDistributionQuery,
  areaStatsQuery,
  boulderByIdQuery,
  boulderTopoRoutesQuery,
  boulderToposQuery,
  cragBouldersWithStatsQuery,
  cragBySlugQuery,
  cragRoutesQuery,
  cragSectorsQuery,
  cragStatsQuery,
  cragsByAreaIdQuery,
  getAllRouteItemsFlat,
  getAreaBySlug,
  getCragBySlug,
  getRouteById,
  getTopoById,
  parseHashtags,
  publishedAnnouncementsQuery,
  publishedAreasQuery,
  sectorBySlugQuery,
  sectorRoutesQuery,
  statsQuery,
  topoRoutesQuery,
} from "./queries";
import { batchD1, queryD1First } from "./d1-http";
import type {
  AreaDetail,
  BoulderDetail,
  CragDetail,
  GradeBand,
  HomeModel,
  Route,
  RouteListItem,
  SectorDetail,
  Stats,
  TopoDetail,
} from "./schema";
import { GRADE_BUCKET_COUNT } from "../grade-histogram";

function buildCragGradeCountsByCragId(
  rows: Array<{ cragId: string; gradeNum: number; count: number }>
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const n = Math.floor(row.gradeNum);
    if (!Number.isFinite(n) || n < 0) continue;
    const idx = n >= GRADE_BUCKET_COUNT - 1 ? GRADE_BUCKET_COUNT - 1 : n;
    let bars = map.get(row.cragId);
    if (!bars) {
      bars = Array.from({ length: GRADE_BUCKET_COUNT }, () => 0);
      map.set(row.cragId, bars);
    }
    bars[idx] += row.count;
  }
  return map;
}

function emptyGradeCounts(): number[] {
  return Array.from({ length: GRADE_BUCKET_COUNT }, () => 0);
}

function buildCragStatsById(
  rows: Array<{ cragId: string } & Omit<Stats, "crags">>
): Map<string, Omit<Stats, "crags">> {
  const map = new Map<string, Omit<Stats, "crags">>();
  for (const { cragId, ...stats } of rows) {
    map.set(cragId, stats);
  }
  return map;
}

// Re-export so that page components can `import type { AreaDetail } from "@/lib/db/repository"`
// alongside the `findAreaDetailBySlug` function. Mirrors the `RouteListItem` re-export in queries.ts.
export type { AreaDetail, GradeBand };

export const CRAG_TABS = ["Info", "Sector", "Boulder", "Route", "Map", "Travel"] as const;
export const SECTOR_TABS = ["Info", "Boulder", "Route", "Map", "Travel"] as const;

/**
 * Parses boulder hashtag JSON defensively.
 * Kept as a named export — used by other modules (e.g. import pipeline).
 * Delegates to queries.parseHashtags which has identical behaviour.
 */
export function parseBoulderHashtags(hashtagsJson: string): string[] {
  return parseHashtags(hashtagsJson);
}

// ---------------------------------------------------------------------------
// Private load helpers (un-cached, used by the cache wrappers below)
//
// Each logical query is a D1Query descriptor so a whole "wave" of independent
// queries shares ONE D1 HTTP round trip via batchD1 (the HTTP API costs
// 150-400ms per request — see ADR 0003 and the 2026-07-09 batching spec).
// ---------------------------------------------------------------------------

async function loadAreaBySlug(slug: string): Promise<AreaDetail | null> {
  const area = await getAreaBySlug(slug);
  if (!area) return null;

  const [stats, gradeDistribution, areaCrags, cragLocations, gradeCountRows, cragStatsRows] =
    await batchD1([
      areaStatsQuery(area.id),
      areaGradeDistributionQuery(area.id),
      cragsByAreaIdQuery(area.id),
      areaCragsWithCoordsQuery(area.id),
      allCragGradeCountsQuery(),
      allCragStatsQuery(area.id),
    ]);

  const cragGradeCountsByCragId = buildCragGradeCountsByCragId(gradeCountRows);
  const cragStatsById = buildCragStatsById(cragStatsRows);

  return {
    ...area,
    stats,
    gradeDistribution,
    crags: areaCrags.map((crag) => ({
      ...crag,
      stats: cragStatsById.get(crag.id) ?? { sectors: 0, boulders: 0, routes: 0 },
      gradeCounts: cragGradeCountsByCragId.get(crag.id) ?? emptyGradeCounts(),
    })),
    cragLocations,
  };
}

async function loadHomeModel(): Promise<HomeModel> {
  const [totals, areas, allCragsFlat, announcements, gradeCountRows, cragStatsRows] =
    await batchD1([
      statsQuery(),
      publishedAreasQuery(),
      allPublishedCragsQuery(),
      publishedAnnouncementsQuery(),
      allCragGradeCountsQuery(),
      allCragStatsQuery(),
    ]);

  const cragGradeCountsByCragId = buildCragGradeCountsByCragId(gradeCountRows);

  // Per-area stats come from grouping the flat crag list (we already have all
  // crags) joined with the one-query per-crag stats from allCragStatsQuery.
  const cragStatsById = buildCragStatsById(cragStatsRows);

  // Group crags by areaId to compute per-area aggregate stats.
  const cragsByAreaId = new Map<string, typeof allCragsFlat>();
  for (const crag of allCragsFlat) {
    const list = cragsByAreaId.get(crag.areaId) ?? [];
    list.push(crag);
    cragsByAreaId.set(crag.areaId, list);
  }

  const areasWithStats = areas.map((area) => {
    const areaCrags = cragsByAreaId.get(area.id) ?? [];
    const areaStats: Stats = areaCrags.reduce<Stats>(
      (acc, crag) => {
        const s = cragStatsById.get(crag.id) ?? { sectors: 0, boulders: 0, routes: 0 };
        return {
          crags: acc.crags,
          sectors: acc.sectors + s.sectors,
          boulders: acc.boulders + s.boulders,
          routes: acc.routes + s.routes,
        };
      },
      { crags: areaCrags.length, sectors: 0, boulders: 0, routes: 0 }
    );
    return { ...area, stats: areaStats };
  });

  const allCrags = allCragsFlat.map((crag) => ({
    ...crag,
    stats: cragStatsById.get(crag.id) ?? { sectors: 0, boulders: 0, routes: 0 },
    gradeCounts: cragGradeCountsByCragId.get(crag.id) ?? emptyGradeCounts(),
  }));

  return { totals, areas: areasWithStats, allCrags, announcements };
}

async function loadCragBySlug(slug: string): Promise<CragDetail | null> {
  const crag = await getCragBySlug(slug);
  if (!crag) return null;

  const [sectors, boulders, routes, stats] = await batchD1([
    cragSectorsQuery(crag.id),
    cragBouldersWithStatsQuery(crag.id),
    cragRoutesQuery(crag.id),
    cragStatsQuery(crag.id),
  ]);

  return {
    ...crag,
    tabs: [...CRAG_TABS],
    stats: { crags: 1, ...stats },
    sectors,
    boulders,
    routes,
  };
}

async function loadSectorBySlug(
  cragSlug: string,
  sectorSlug: string
): Promise<SectorDetail | null> {
  const [crag, sector] = await batchD1([
    cragBySlugQuery(cragSlug),
    sectorBySlugQuery(cragSlug, sectorSlug),
  ]);

  if (!crag || !sector) return null;

  const [boulders, routes] = await batchD1([
    cragBouldersWithStatsQuery(sector.cragId, sector.id),
    sectorRoutesQuery(sector.id),
  ]);

  return {
    ...sector,
    tabs: [...SECTOR_TABS],
    crag,
    stats: {
      sectors: 1,
      boulders: boulders.length,
      routes: routes.length,
    },
    boulders,
    routes,
  };
}

async function loadBoulderById(id: string): Promise<BoulderDetail | null> {
  const [boulder, topoList, boulderRoutes] = await batchD1([
    boulderByIdQuery(id),
    boulderToposQuery(id),
    boulderTopoRoutesQuery(id),
  ]);
  if (!boulder) return null;

  // boulderTopoRoutesQuery is ordered by topo then route sort_order, so
  // grouping preserves each topo's route order.
  const routesByTopoId = new Map<string, Route[]>();
  for (const route of boulderRoutes) {
    const list = routesByTopoId.get(route.topoId) ?? [];
    list.push(route);
    routesByTopoId.set(route.topoId, list);
  }

  const toposWithRoutes = topoList.map((topo) => ({
    ...topo,
    routes: routesByTopoId.get(topo.id) ?? [],
  }));

  return {
    ...boulder,
    hashtagsList: parseBoulderHashtags(boulder.hashtags),
    topos: toposWithRoutes,
  };
}

async function loadTopoById(id: string): Promise<TopoDetail | null> {
  const topoWithCtx = await getTopoById(id);
  if (!topoWithCtx) return null;

  const { boulder, sector, crag, ...topo } = topoWithCtx;

  const [boulderTopos, routes] = await batchD1([
    boulderToposQuery(boulder.id),
    topoRoutesQuery(id),
  ]);

  const currentIdx = boulderTopos.findIndex((t) => t.id === id);
  const topoIndex = currentIdx + 1;
  const topoCount = boulderTopos.length;
  const prevTopoId = currentIdx > 0 ? (boulderTopos[currentIdx - 1]?.id ?? null) : null;
  const nextTopoId = currentIdx < topoCount - 1 ? (boulderTopos[currentIdx + 1]?.id ?? null) : null;

  return {
    ...topo,
    topoIndex,
    topoCount,
    prevTopoId,
    nextTopoId,
    boulder,
    sector,
    crag,
    routes,
  };
}

async function loadRouteById(id: string): Promise<RouteListItem | null> {
  return getRouteById(id);
}

async function loadAllRouteItems(): Promise<RouteListItem[]> {
  return getAllRouteItemsFlat();
}

// ---------------------------------------------------------------------------
// Public API — each function wraps its loader in unstable_cache
// ---------------------------------------------------------------------------

export async function findAreaDetailBySlug(slug: string): Promise<AreaDetail | null> {
  const cached = unstable_cache(
    () => loadAreaBySlug(slug),
    ["findAreaDetailBySlug", slug],
    { tags: ["areas:list", `area:${slug}`] }
  );
  return cached();
}

export async function getHomeModel(): Promise<HomeModel> {
  const cached = unstable_cache(loadHomeModel, ["getHomeModel"], {
    tags: ["home", "areas:list"],
  });
  return cached();
}

export async function findCragBySlug(slug: string): Promise<CragDetail | null> {
  // Tag uses the slug because the id is not known before fetching.
  const cached = unstable_cache(
    () => loadCragBySlug(slug),
    ["findCragBySlug", slug],
    { tags: ["areas:list", `crag:${slug}`] }
  );
  return cached();
}

export async function findSectorBySlug(
  cragSlug: string,
  sectorSlug: string
): Promise<SectorDetail | null> {
  // Tag uses slugs because ids are not known before fetching.
  const cached = unstable_cache(
    () => loadSectorBySlug(cragSlug, sectorSlug),
    ["findSectorBySlug", cragSlug, sectorSlug],
    { tags: [`crag:${cragSlug}`, `sector:${sectorSlug}`] }
  );
  return cached();
}

export async function findBoulderById(id: string): Promise<BoulderDetail | null> {
  const cached = unstable_cache(
    () => loadBoulderById(id),
    ["findBoulderById", id],
    { tags: [`boulder:${id}`] }
  );
  return cached();
}

export async function findTopoById(id: string): Promise<TopoDetail | null> {
  // No dedicated "topo:<id>" tag — topos live under boulders in the hierarchy.
  const cached = unstable_cache(
    () => loadTopoById(id),
    ["findTopoById", id],
    { tags: [`boulder:${id}`] }
  );
  return cached();
}

export async function findRouteById(id: string): Promise<RouteListItem | null> {
  const cached = unstable_cache(
    () => loadRouteById(id),
    ["findRouteById", id],
    { tags: [`route:${id}`] }
  );
  return cached();
}

/**
 * Returns all published route items across all crags.
 * Used by admin pages — not cached with a fine-grained tag; invalidate via
 * `revalidateTag("areas:list")` after any route mutation.
 */
export async function getAllRouteItems(): Promise<RouteListItem[]> {
  const cached = unstable_cache(loadAllRouteItems, ["getAllRouteItems"], {
    tags: ["areas:list"],
  });
  return cached();
}

// ---------------------------------------------------------------------------
// Beta / caption context
// ---------------------------------------------------------------------------

export type RouteCaptionContext = {
  routeName: string;
  grade: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  boulderHashtags: string[];
};

interface RouteCaptionContextRow {
  routeName: string;
  grade: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  boulderHashtags: string;
}

async function loadRouteCaptionContext(
  routeId: string
): Promise<RouteCaptionContext | null> {
  const row = await queryD1First<RouteCaptionContextRow>(
    `SELECT
       r.name AS routeName,
       r.grade AS grade,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       b.hashtags AS boulderHashtags
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
    [routeId]
  );

  if (!row) return null;

  return {
    routeName: row.routeName,
    grade: row.grade,
    boulderName: row.boulderName,
    sectorName: row.sectorName,
    cragName: row.cragName,
    boulderHashtags: parseHashtags(row.boulderHashtags),
  };
}

/**
 * Returns the display context for a published route, used when matching
 * Instagram captions and building beta entries.
 * Cached with tag `route:<routeId>`.
 */
export async function findRouteCaptionContext(
  routeId: string
): Promise<RouteCaptionContext | null> {
  const cached = unstable_cache(
    () => loadRouteCaptionContext(routeId),
    ["findRouteCaptionContext", routeId],
    { tags: [`route:${routeId}`] }
  );
  return cached();
}
