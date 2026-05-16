import {
  announcements,
  areas,
  boulders,
  crags,
  routes,
  sectors,
  topos
} from "./seed";
import type {
  Boulder,
  BoulderDetail,
  Crag,
  CragDetail,
  HomeModel,
  RouteListItem,
  Sector,
  SectorDetail,
  Stats
} from "./schema";

const CRAG_TABS = ["Info", "Sector", "Boulder", "Route", "Map", "Travel"] as const;
const SECTOR_TABS = ["Info", "Boulder", "Route", "Map", "Travel"] as const;

export function parseBoulderHashtags(hashtagsJson: string): string[] {
  try {
    const parsedValue: unknown = JSON.parse(hashtagsJson);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function getHomeModel(): HomeModel {
  const publishedCrags = crags.filter((crag) => crag.isPublished);
  const publishedSectors = sectors.filter((sector) => sector.isPublished);
  const publishedBoulders = boulders.filter((boulder) => boulder.isPublished);
  const publishedRoutes = routes.filter((route) => route.isPublished);

  return {
    totals: {
      crags: publishedCrags.length,
      sectors: publishedSectors.length,
      boulders: publishedBoulders.length,
      routes: publishedRoutes.length
    },
    areas: [...areas]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((area) => {
        const areaCrags = publishedCrags.filter((crag) => crag.areaId === area.id);
        return {
          ...area,
          stats: buildStatsForCrags(areaCrags),
          crags: areaCrags.map((crag) => ({
            ...crag,
            stats: buildStatsForCrag(crag)
          }))
        };
      }),
    announcements: announcements
      .filter((announcement) => announcement.isPublished)
      .sort((left, right) => left.sortOrder - right.sortOrder)
  };
}

export function findCragBySlug(slug: string): CragDetail | null {
  const crag = crags.find((candidate) => candidate.slug === slug && candidate.isPublished);
  if (!crag) {
    return null;
  }

  const scopedSectors = sectors.filter((sector) => sector.cragId === crag.id && sector.isPublished);
  const scopedBoulders = getBouldersForSectors(scopedSectors);
  const scopedRoutes = getRouteItemsForBoulders(scopedBoulders);

  return {
    ...crag,
    tabs: [...CRAG_TABS],
    stats: { crags: 1, ...buildStatsForCrag(crag) },
    sectors: scopedSectors,
    boulders: scopedBoulders.map(withBoulderStats),
    routes: scopedRoutes
  };
}

export function findSectorBySlug(cragSlug: string, sectorSlug: string): SectorDetail | null {
  const crag = crags.find((candidate) => candidate.slug === cragSlug && candidate.isPublished);
  if (!crag) {
    return null;
  }

  const sector = sectors.find(
    (candidate) => candidate.cragId === crag.id && candidate.slug === sectorSlug && candidate.isPublished
  );
  if (!sector) {
    return null;
  }

  const scopedBoulders = boulders.filter(
    (boulder) => boulder.sectorId === sector.id && boulder.isPublished
  );
  const scopedRoutes = getRouteItemsForBoulders(scopedBoulders);

  return {
    ...sector,
    tabs: [...SECTOR_TABS],
    crag,
    stats: {
      sectors: 1,
      boulders: scopedBoulders.length,
      routes: scopedRoutes.length
    },
    boulders: scopedBoulders.map(withBoulderStats),
    routes: scopedRoutes
  };
}

export function findBoulderById(id: string): BoulderDetail | null {
  const boulder = boulders.find((candidate) => candidate.id === id && candidate.isPublished);
  if (!boulder) {
    return null;
  }

  return {
    ...boulder,
    hashtagsList: parseBoulderHashtags(boulder.hashtags),
    topos: topos
      .filter((topo) => topo.boulderId === boulder.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((topo) => ({
        ...topo,
        routes: routes.filter((route) => route.topoId === topo.id && route.isPublished)
      }))
  };
}

export function findRouteById(id: string): RouteListItem | null {
  return getAllRouteItems().find((route) => route.id === id) ?? null;
}

export function getAllRouteItems(): RouteListItem[] {
  return getRouteItemsForBoulders(boulders.filter((boulder) => boulder.isPublished));
}

function buildStatsForCrags(scopedCrags: Crag[]): Stats {
  const scopedSectors = sectors.filter((sector) =>
    scopedCrags.some((crag) => crag.id === sector.cragId && crag.isPublished) && sector.isPublished
  );
  const scopedBoulders = getBouldersForSectors(scopedSectors);
  const scopedRoutes = routes.filter(
    (route) => scopedBoulders.some((boulder) => boulder.id === route.boulderId) && route.isPublished
  );

  return {
    crags: scopedCrags.length,
    sectors: scopedSectors.length,
    boulders: scopedBoulders.length,
    routes: scopedRoutes.length
  };
}

function buildStatsForCrag(crag: Crag): Omit<Stats, "crags"> {
  const scopedSectors = sectors.filter((sector) => sector.cragId === crag.id && sector.isPublished);
  const scopedBoulders = getBouldersForSectors(scopedSectors);
  const scopedRoutes = routes.filter(
    (route) => scopedBoulders.some((boulder) => boulder.id === route.boulderId) && route.isPublished
  );

  return {
    sectors: scopedSectors.length,
    boulders: scopedBoulders.length,
    routes: scopedRoutes.length
  };
}

function getBouldersForSectors(scopedSectors: Sector[]): Boulder[] {
  return boulders.filter(
    (boulder) => scopedSectors.some((sector) => sector.id === boulder.sectorId) && boulder.isPublished
  );
}

function getRouteItemsForBoulders(scopedBoulders: Boulder[]): RouteListItem[] {
  return routes
    .filter((route) => scopedBoulders.some((boulder) => boulder.id === route.boulderId) && route.isPublished)
    .map((route) => {
      const boulder = boulders.find((candidate) => candidate.id === route.boulderId);
      const sector = boulder ? sectors.find((candidate) => candidate.id === boulder.sectorId) : undefined;
      const crag = sector ? crags.find((candidate) => candidate.id === sector.cragId) : undefined;

      if (!boulder || !sector || !crag) {
        throw new Error(`Route ${route.id} has an invalid hierarchy`);
      }

      return {
        ...route,
        boulderName: boulder.name,
        sectorName: sector.name,
        cragName: crag.name,
        cragSlug: crag.slug,
        sectorSlug: sector.slug
      };
    });
}

function withBoulderStats(boulder: Boulder): Boulder & {
  routeCount: number;
  gradeRange: string;
  hashtagsList: string[];
} {
  const boulderRoutes = routes.filter((route) => route.boulderId === boulder.id && route.isPublished);
  const routeGrades = boulderRoutes.map((route) => route.gradeNum).sort((left, right) => left - right);
  const minGrade = routeGrades.at(0);
  const maxGrade = routeGrades.at(-1);

  return {
    ...boulder,
    routeCount: boulderRoutes.length,
    gradeRange: minGrade === undefined || maxGrade === undefined ? "—" : `V${minGrade}-V${maxGrade}`,
    hashtagsList: parseBoulderHashtags(boulder.hashtags)
  };
}
