import { unstable_cache } from "next/cache";
import {
  getBoulderById,
  getBoulderTopos,
  getCragBySlug,
  getCragBouldersWithStats,
  getCragRoutes,
  getCragSectors,
  getCragStats,
  getAllPublishedCrags,
  getPublishedAreas,
  getPublishedAnnouncements,
  getCragsByAreaId,
  getAreaBySlug,
  getAreaStats,
  getAreaGradeDistribution,
  getAreaCragsWithCoords,
  getRouteById,
  getSectorBySlug,
  getSectorRoutes,
  getStats,
  getTopoById,
  getTopoRoutes,
  parseHashtags,
} from "./queries";
import type {
  AreaDetail,
  BoulderDetail,
  CragDetail,
  GradeBand,
  HomeModel,
  RouteListItem,
  SectorDetail,
  Stats,
  TopoDetail,
} from "./schema";

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
// ---------------------------------------------------------------------------

async function loadAreaBySlug(slug: string): Promise<AreaDetail | null> {
  const area = await getAreaBySlug(slug);
  if (!area) return null;

  const [stats, gradeDistribution, areaCrags, cragLocations] = await Promise.all([
    getAreaStats(area.id),
    getAreaGradeDistribution(area.id),
    getCragsByAreaId(area.id),
    getAreaCragsWithCoords(area.id),
  ]);

  const cragStats = await Promise.all(
    areaCrags.map((crag) => getCragStats(crag.id))
  );

  return {
    ...area,
    stats,
    gradeDistribution,
    crags: areaCrags.map((crag, i) => ({
      ...crag,
      stats: cragStats[i] ?? { sectors: 0, boulders: 0, routes: 0 },
    })),
    cragLocations,
  };
}

async function loadHomeModel(): Promise<HomeModel> {
  const [totals, areas, allCragsFlat, announcements] = await Promise.all([
    getStats(),
    getPublishedAreas(),
    getAllPublishedCrags(),
    getPublishedAnnouncements(),
  ]);

  // Build per-area stats by grouping the flat crag list (avoids N queries to
  // getCragsByAreaId — we already have all crags from getAllPublishedCrags).
  // We still need getCragStats for sector/boulder/route counts per crag.
  const allCragStats = await Promise.all(
    allCragsFlat.map((crag) => getCragStats(crag.id))
  );

  // Map cragId → stats for fast lookup when aggregating per-area totals.
  const cragStatsById = new Map<string, Omit<Stats, "crags">>();
  allCragsFlat.forEach((crag, i) => {
    cragStatsById.set(crag.id, allCragStats[i] ?? { sectors: 0, boulders: 0, routes: 0 });
  });

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
  }));

  return { totals, areas: areasWithStats, allCrags, announcements };
}

async function loadCragBySlug(slug: string): Promise<CragDetail | null> {
  const crag = await getCragBySlug(slug);
  if (!crag) return null;

  const [sectors, boulders, routes, stats] = await Promise.all([
    getCragSectors(crag.id),
    getCragBouldersWithStats(crag.id),
    getCragRoutes(crag.id),
    getCragStats(crag.id),
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
  const [crag, sector] = await Promise.all([
    getCragBySlug(cragSlug),
    getSectorBySlug(cragSlug, sectorSlug),
  ]);

  if (!crag || !sector) return null;

  const [boulders, routes] = await Promise.all([
    getCragBouldersWithStats(sector.cragId, sector.id),
    getSectorRoutes(sector.id),
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
  const boulder = await getBoulderById(id);
  if (!boulder) return null;

  const topoList = await getBoulderTopos(id);
  const toposWithRoutes = await Promise.all(
    topoList.map(async (topo) => ({
      ...topo,
      routes: await getTopoRoutes(topo.id),
    }))
  );

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

  const [boulderTopos, routes] = await Promise.all([
    getBoulderTopos(boulder.id),
    getTopoRoutes(id),
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
  const areas = await getPublishedAreas();
  const cragArrays = await Promise.all(
    areas.map((area) => getCragsByAreaId(area.id))
  );
  const allCrags = cragArrays.flat();
  const routeArrays = await Promise.all(
    allCrags.map((crag) => getCragRoutes(crag.id))
  );
  return routeArrays.flat();
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
