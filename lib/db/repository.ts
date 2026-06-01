import { unstable_cache } from "next/cache";
import {
  getBoulderById,
  getBoulderTopos,
  getCragBySlug,
  getCragBouldersWithStats,
  getCragRoutes,
  getCragSectors,
  getCragStats,
  getPublishedAreas,
  getPublishedAnnouncements,
  getCragsByAreaId,
  getAreaBySlug,
  getAreaStats,
  getAreaGradeDistribution,
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
  HomeModel,
  RouteListItem,
  SectorDetail,
  Stats,
  TopoDetail,
} from "./schema";

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

  const [stats, gradeDistribution, areaCrags] = await Promise.all([
    getAreaStats(area.id),
    getAreaGradeDistribution(area.id),
    getCragsByAreaId(area.id),
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
  };
}

async function loadHomeModel(): Promise<HomeModel> {
  const [totals, areas, announcements] = await Promise.all([
    getStats(),
    getPublishedAreas(),
    getPublishedAnnouncements(),
  ]);

  const areasWithCrags = await Promise.all(
    areas.map(async (area) => {
      const areaCrags = await getCragsByAreaId(area.id);

      const cragStats = await Promise.all(
        areaCrags.map((crag) => getCragStats(crag.id))
      );

      // Aggregate per-area stats = sum of each crag's stats + crag count
      const areaStats: Stats = cragStats.reduce<Stats>(
        (acc, s) => ({
          crags: acc.crags,
          sectors: acc.sectors + s.sectors,
          boulders: acc.boulders + s.boulders,
          routes: acc.routes + s.routes,
        }),
        { crags: areaCrags.length, sectors: 0, boulders: 0, routes: 0 }
      );

      return {
        ...area,
        stats: areaStats,
        crags: areaCrags.map((crag, i) => ({
          ...crag,
          stats: cragStats[i] ?? { sectors: 0, boulders: 0, routes: 0 },
        })),
      };
    })
  );

  return { totals, areas: areasWithCrags, announcements };
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

  const topoIndex = boulderTopos.findIndex((t) => t.id === id) + 1;
  const topoCount = boulderTopos.length;

  return {
    ...topo,
    topoIndex,
    topoCount,
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
