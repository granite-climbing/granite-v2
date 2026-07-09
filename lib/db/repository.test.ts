import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock next/cache — pass-through so caching doesn't interfere
// ---------------------------------------------------------------------------
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

// ---------------------------------------------------------------------------
// Mock ./d1-http — batchD1 executes each descriptor's map over empty rows.
// The mocked query builders below return stubs whose map ignores the rows and
// returns the fixture directly, so this faithfully simulates one batched
// round trip. Defined as a plain function (not vi.fn) so resetAllMocks
// doesn't wipe the implementation.
// ---------------------------------------------------------------------------
vi.mock("./d1-http", () => ({
  batchD1: (
    descriptors: ReadonlyArray<{ map: (rows: unknown[]) => unknown }>
  ) => Promise.resolve(descriptors.map((d) => d.map([]))),
  queryD1First: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ./queries with small deterministic fixtures
// ---------------------------------------------------------------------------
vi.mock("./queries", () => ({
  // Descriptor builders (batched via batchD1)
  statsQuery: vi.fn(),
  publishedAreasQuery: vi.fn(),
  allPublishedCragsQuery: vi.fn(),
  publishedAnnouncementsQuery: vi.fn(),
  allCragGradeCountsQuery: vi.fn(),
  allCragStatsQuery: vi.fn(),
  cragsByAreaIdQuery: vi.fn(),
  areaStatsQuery: vi.fn(),
  areaGradeDistributionQuery: vi.fn(),
  areaCragsWithCoordsQuery: vi.fn(),
  cragBySlugQuery: vi.fn(),
  cragSectorsQuery: vi.fn(),
  cragBouldersWithStatsQuery: vi.fn(),
  cragRoutesQuery: vi.fn(),
  cragStatsQuery: vi.fn(),
  sectorBySlugQuery: vi.fn(),
  sectorRoutesQuery: vi.fn(),
  boulderByIdQuery: vi.fn(),
  boulderToposQuery: vi.fn(),
  boulderTopoRoutesQuery: vi.fn(),
  topoRoutesQuery: vi.fn(),
  // Plain async functions (single-query paths)
  getAreaBySlug: vi.fn(),
  getCragBySlug: vi.fn(),
  getTopoById: vi.fn(),
  getRouteById: vi.fn(),
  getAllRouteItemsFlat: vi.fn(),
  // Helpers
  parseHashtags: (raw: string): string[] => {
    try {
      const p: unknown = JSON.parse(raw);
      if (!Array.isArray(p)) return [];
      return p.filter((v): v is string => typeof v === "string");
    } catch {
      return [];
    }
  },
  formatGradeRange: (min: number | null, max: number | null): string => {
    if (min === null || max === null) return "—";
    if (min === max) return `V${min}`;
    return `V${min}-V${max}`;
  },
}));

import * as queries from "./queries";

// Builds a descriptor stub whose map returns `value` regardless of rows —
// pairs with the batchD1 mock above.
function stubQuery<T>(value: T) {
  return { sql: "", params: [] as unknown[], map: () => value };
}
import {
  findAreaDetailBySlug,
  findBoulderById,
  findCragBySlug,
  findRouteById,
  findSectorBySlug,
  findTopoById,
  getAllRouteItems,
  getHomeModel,
  parseBoulderHashtags,
} from "./repository";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const AREA_1 = {
  id: "area-1",
  name: "수도권",
  nameEn: "Seoul Metro",
  slug: "seoul",
  coverImageUrl: "https://cdn/areas/seoul.jpg",
  isPublished: true,
  sortOrder: 1,
};

const CRAG_1 = {
  id: "crag-1",
  areaId: "area-1",
  name: "모락산",
  nameEn: "Moraksan",
  slug: "moraksan",
  lat: 37.4,
  lng: 127.0,
  description: "좋은 암장",
  season: "봄/가을",
  coverImageUrl: "https://cdn/crags/moraksan.jpg",
  isPublished: true,
  sortOrder: 1,
};

const CRAG_2 = {
  id: "crag-2",
  areaId: "area-1",
  name: "안양",
  nameEn: "Anyang",
  slug: "anyang",
  lat: 37.39,
  lng: 126.95,
  description: "안양 암장",
  season: "봄/가을",
  coverImageUrl: "https://cdn/crags/anyang.jpg",
  isPublished: true,
  sortOrder: 2,
};

const SECTOR_1 = {
  id: "sector-1",
  cragId: "crag-1",
  name: "감자",
  nameEn: null,
  slug: "gamja",
  lat: null,
  lng: null,
  description: "감자 섹터",
  season: "봄/가을",
  coverImageUrl: "https://cdn/sectors/gamja.jpg",
  isPublished: true,
  sortOrder: 1,
};

const BOULDER_1 = {
  id: "boulder-1",
  sectorId: "sector-1",
  name: "큰바위",
  slug: "big-rock",
  lat: 37.4,
  lng: 127.0,
  hashtags: '["모락산","슬랩"]',
  coverImageUrl: "https://cdn/boulders/big-rock.jpg",
  isPublished: true,
  sortOrder: 1,
};

const BOULDER_WITH_STATS = {
  ...BOULDER_1,
  routeCount: 2,
  gradeRange: "V3-V5",
  hashtagsList: ["모락산", "슬랩"],
};

const TOPO_1 = {
  id: "topo-1",
  boulderId: "boulder-1",
  name: "정면",
  baseImageUrl: "https://cdn/topos/topo-1.jpg",
  isPublished: true,
  sortOrder: 1,
};

const TOPO_2 = {
  id: "topo-2",
  boulderId: "boulder-1",
  name: "측면",
  baseImageUrl: "https://cdn/topos/topo-2.jpg",
  isPublished: true,
  sortOrder: 2,
};

const ROUTE_1 = {
  id: "route-1",
  topoId: "topo-1",
  name: "Sky Hook",
  slug: "sky-hook",
  grade: "V5",
  gradeNum: 5,
  fa: "홍길동",
  description: "",
  lineImageUrl: "https://cdn/routes/sky-hook.jpg",
  isPublished: true,
  sortOrder: 1,
};

const ROUTE_LIST_ITEM_1: queries.RouteListItem = {
  ...ROUTE_1,
  boulderId: "boulder-1",
  boulderName: "큰바위",
  sectorName: "감자",
  cragName: "모락산",
  cragSlug: "moraksan",
  sectorSlug: "gamja",
};

// Make RouteListItem importable via the type (it's re-exported from schema)
// The "as" cast is fine since mock shapes match schema.
import type { RouteListItem } from "./schema";

// ---------------------------------------------------------------------------
// Reset mocks between tests. Every descriptor builder gets a safe default so
// batched loaders never hit an unmocked builder; tests override as needed.
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(queries.statsQuery).mockReturnValue(
    stubQuery({ crags: 0, sectors: 0, boulders: 0, routes: 0 })
  );
  vi.mocked(queries.publishedAreasQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.allPublishedCragsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.publishedAnnouncementsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.allCragGradeCountsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.allCragStatsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.areaStatsQuery).mockReturnValue(
    stubQuery({ crags: 0, sectors: 0, boulders: 0, routes: 0 })
  );
  vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.areaCragsWithCoordsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.cragBySlugQuery).mockReturnValue(stubQuery(null));
  vi.mocked(queries.cragSectorsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.cragBouldersWithStatsQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.cragRoutesQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.cragStatsQuery).mockReturnValue(
    stubQuery({ sectors: 0, boulders: 0, routes: 0 })
  );
  vi.mocked(queries.sectorBySlugQuery).mockReturnValue(stubQuery(null));
  vi.mocked(queries.sectorRoutesQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.boulderByIdQuery).mockReturnValue(stubQuery(null));
  vi.mocked(queries.boulderToposQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.boulderTopoRoutesQuery).mockReturnValue(stubQuery([]));
  vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([]));
});

// ---------------------------------------------------------------------------
// getHomeModel
// ---------------------------------------------------------------------------
describe("getHomeModel", () => {
  it("composes totals, area stats, allCrags, and crag stats from mocked queries", async () => {
    vi.mocked(queries.statsQuery).mockReturnValue(
      stubQuery({ crags: 2, sectors: 3, boulders: 4, routes: 7 })
    );
    vi.mocked(queries.publishedAreasQuery).mockReturnValue(stubQuery([AREA_1]));
    vi.mocked(queries.allPublishedCragsQuery).mockReturnValue(
      stubQuery([CRAG_1, CRAG_2])
    );
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([
        { cragId: "crag-1", sectors: 2, boulders: 3, routes: 5 },
        { cragId: "crag-2", sectors: 1, boulders: 1, routes: 2 },
      ])
    );

    const model = await getHomeModel();

    // Global totals come directly from getStats()
    expect(model.totals).toEqual({ crags: 2, sectors: 3, boulders: 4, routes: 7 });

    // One area — no nested crags field
    expect(model.areas).toHaveLength(1);
    const area = model.areas[0]!;
    expect(area.name).toBe("수도권");
    expect("crags" in area).toBe(false);

    // Area stats = aggregate of both crags
    expect(area.stats).toEqual({
      crags: 2,
      sectors: 3,     // 2 + 1
      boulders: 4,    // 3 + 1
      routes: 7,      // 5 + 2
    });

    // Flat allCrags list at top level
    expect(model.allCrags).toHaveLength(2);
    expect(model.allCrags[0]!.stats).toEqual({ sectors: 2, boulders: 3, routes: 5 });
    expect(model.allCrags[1]!.stats).toEqual({ sectors: 1, boulders: 1, routes: 2 });
    expect(model.allCrags.map((c) => c.slug)).toEqual(["moraksan", "anyang"]);
  });

  it("returns empty areas/allCrags/announcements arrays when nothing is published", async () => {
    // beforeEach defaults already stub every home query as empty
    const model = await getHomeModel();
    expect(model.areas).toHaveLength(0);
    expect(model.allCrags).toHaveLength(0);
    expect(model.announcements).toHaveLength(0);
  });

  it("area stats are zero when its crags are absent from allCrags (e.g. different area)", async () => {
    const AREA_2 = {
      ...AREA_1,
      id: "area-2",
      name: "영남권",
      slug: "yeongnam",
    };
    vi.mocked(queries.statsQuery).mockReturnValue(
      stubQuery({ crags: 1, sectors: 1, boulders: 1, routes: 1 })
    );
    // Two areas, but allCrags only has CRAG_1 which belongs to area-1
    vi.mocked(queries.publishedAreasQuery).mockReturnValue(
      stubQuery([AREA_1, AREA_2])
    );
    vi.mocked(queries.allPublishedCragsQuery).mockReturnValue(stubQuery([CRAG_1]));
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([{ cragId: "crag-1", sectors: 2, boulders: 3, routes: 5 }])
    );

    const model = await getHomeModel();

    expect(model.areas).toHaveLength(2);
    const area1 = model.areas.find((a) => a.id === "area-1")!;
    const area2 = model.areas.find((a) => a.id === "area-2")!;

    // area-1 has CRAG_1
    expect(area1.stats).toEqual({ crags: 1, sectors: 2, boulders: 3, routes: 5 });
    // area-2 has no crags in allCrags → all-zero stats
    expect(area2.stats).toEqual({ crags: 0, sectors: 0, boulders: 0, routes: 0 });

    // allCrags is just the flat list from getAllPublishedCrags
    expect(model.allCrags).toHaveLength(1);
    expect(model.allCrags[0]!.slug).toBe("moraksan");
  });

  it("uses allPublishedCragsQuery (not cragsByAreaIdQuery) for the flat crag list", async () => {
    await getHomeModel();

    expect(vi.mocked(queries.allPublishedCragsQuery)).toHaveBeenCalledOnce();
    expect(vi.mocked(queries.cragsByAreaIdQuery)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// findCragBySlug
// ---------------------------------------------------------------------------
describe("findCragBySlug", () => {
  it("returns null when crag is not found", async () => {
    vi.mocked(queries.getCragBySlug).mockResolvedValue(null);

    const result = await findCragBySlug("nonexistent");
    expect(result).toBeNull();
  });

  it("returns populated CragDetail with tabs, stats, sectors, boulders, routes", async () => {
    vi.mocked(queries.getCragBySlug).mockResolvedValue(CRAG_1);
    vi.mocked(queries.cragSectorsQuery).mockReturnValue(stubQuery([SECTOR_1]));
    vi.mocked(queries.cragBouldersWithStatsQuery).mockReturnValue(
      stubQuery([BOULDER_WITH_STATS])
    );
    vi.mocked(queries.cragRoutesQuery).mockReturnValue(
      stubQuery([ROUTE_LIST_ITEM_1])
    );
    vi.mocked(queries.cragStatsQuery).mockReturnValue(
      stubQuery({ sectors: 1, boulders: 1, routes: 2 })
    );

    const result = await findCragBySlug("moraksan");

    expect(result).not.toBeNull();
    expect(result!.tabs).toEqual(["Info", "Sector", "Boulder", "Route", "Map", "Travel"]);
    expect(result!.stats).toEqual({ crags: 1, sectors: 1, boulders: 1, routes: 2 });
    expect(result!.sectors).toEqual([SECTOR_1]);
    expect(result!.boulders).toEqual([BOULDER_WITH_STATS]);
    expect(result!.routes).toEqual([ROUTE_LIST_ITEM_1]);
    expect(result!.slug).toBe("moraksan");
  });
});

// ---------------------------------------------------------------------------
// findSectorBySlug
// ---------------------------------------------------------------------------
describe("findSectorBySlug", () => {
  it("returns null when crag is not found", async () => {
    vi.mocked(queries.cragBySlugQuery).mockReturnValue(stubQuery(null));
    vi.mocked(queries.sectorBySlugQuery).mockReturnValue(stubQuery(null));

    const result = await findSectorBySlug("nonexistent", "gamja");
    expect(result).toBeNull();
  });

  it("returns null when sector is not found", async () => {
    vi.mocked(queries.cragBySlugQuery).mockReturnValue(stubQuery(CRAG_1));
    vi.mocked(queries.sectorBySlugQuery).mockReturnValue(stubQuery(null));

    const result = await findSectorBySlug("moraksan", "nonexistent");
    expect(result).toBeNull();
  });

  it("returns populated SectorDetail", async () => {
    vi.mocked(queries.cragBySlugQuery).mockReturnValue(stubQuery(CRAG_1));
    vi.mocked(queries.sectorBySlugQuery).mockReturnValue(stubQuery(SECTOR_1));
    vi.mocked(queries.cragBouldersWithStatsQuery).mockReturnValue(
      stubQuery([BOULDER_WITH_STATS])
    );
    vi.mocked(queries.sectorRoutesQuery).mockReturnValue(
      stubQuery([ROUTE_LIST_ITEM_1])
    );

    const result = await findSectorBySlug("moraksan", "gamja");

    expect(result).not.toBeNull();
    expect(result!.tabs).toEqual(["Info", "Boulder", "Route", "Map", "Travel"]);
    expect(result!.crag.slug).toBe("moraksan");
    expect(result!.stats).toEqual({ sectors: 1, boulders: 1, routes: 1 });
    expect(result!.boulders).toEqual([BOULDER_WITH_STATS]);
    expect(result!.routes).toEqual([ROUTE_LIST_ITEM_1]);
  });
});

// ---------------------------------------------------------------------------
// findBoulderById
// ---------------------------------------------------------------------------
describe("findBoulderById", () => {
  it("returns null for unknown id", async () => {
    vi.mocked(queries.boulderByIdQuery).mockReturnValue(stubQuery(null));

    expect(await findBoulderById("missing")).toBeNull();
  });

  it("returns BoulderDetail with parsed hashtagsList and topos+routes", async () => {
    vi.mocked(queries.boulderByIdQuery).mockReturnValue(stubQuery(BOULDER_1));
    vi.mocked(queries.boulderToposQuery).mockReturnValue(
      stubQuery([TOPO_1, TOPO_2])
    );
    // one flat list; ROUTE_1 belongs to topo-1, topo-2 has no routes
    vi.mocked(queries.boulderTopoRoutesQuery).mockReturnValue(
      stubQuery([ROUTE_1])
    );

    const result = await findBoulderById("boulder-1");

    expect(result).not.toBeNull();
    expect(result!.hashtagsList).toEqual(["모락산", "슬랩"]);
    expect(result!.topos).toHaveLength(2);
    expect(result!.topos[0]!.routes).toEqual([ROUTE_1]);
    expect(result!.topos[1]!.routes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findTopoById
// ---------------------------------------------------------------------------
describe("findTopoById", () => {
  it("returns null for unknown id", async () => {
    vi.mocked(queries.getTopoById).mockResolvedValue(null);

    expect(await findTopoById("missing")).toBeNull();
  });

  it("computes topoIndex and topoCount correctly", async () => {
    vi.mocked(queries.getTopoById).mockResolvedValue({
      ...TOPO_2,
      boulder: BOULDER_1,
      sector: SECTOR_1,
      crag: CRAG_1,
    });
    // Two topos for the boulder, topo-2 is second
    vi.mocked(queries.boulderToposQuery).mockReturnValue(
      stubQuery([TOPO_1, TOPO_2])
    );
    vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([ROUTE_1]));

    const result = await findTopoById("topo-2");

    expect(result).not.toBeNull();
    expect(result!.topoCount).toBe(2);
    expect(result!.topoIndex).toBe(2); // second in list
    expect(result!.routes).toEqual([ROUTE_1]);
    expect(result!.boulder.id).toBe("boulder-1");
  });

  it("sets topoIndex to 1 when topo is first", async () => {
    vi.mocked(queries.getTopoById).mockResolvedValue({
      ...TOPO_1,
      boulder: BOULDER_1,
      sector: SECTOR_1,
      crag: CRAG_1,
    });
    vi.mocked(queries.boulderToposQuery).mockReturnValue(
      stubQuery([TOPO_1, TOPO_2])
    );
    vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([]));

    const result = await findTopoById("topo-1");

    expect(result!.topoIndex).toBe(1);
    expect(result!.topoCount).toBe(2);
  });

  it("first topo: prevTopoId is null, nextTopoId is set", async () => {
    vi.mocked(queries.getTopoById).mockResolvedValue({
      ...TOPO_1,
      boulder: BOULDER_1,
      sector: SECTOR_1,
      crag: CRAG_1,
    });
    vi.mocked(queries.boulderToposQuery).mockReturnValue(
      stubQuery([TOPO_1, TOPO_2])
    );
    vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([]));

    const result = await findTopoById("topo-1");

    expect(result!.prevTopoId).toBeNull();
    expect(result!.nextTopoId).toBe("topo-2");
  });

  it("last topo: prevTopoId is set, nextTopoId is null", async () => {
    vi.mocked(queries.getTopoById).mockResolvedValue({
      ...TOPO_2,
      boulder: BOULDER_1,
      sector: SECTOR_1,
      crag: CRAG_1,
    });
    vi.mocked(queries.boulderToposQuery).mockReturnValue(
      stubQuery([TOPO_1, TOPO_2])
    );
    vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([]));

    const result = await findTopoById("topo-2");

    expect(result!.prevTopoId).toBe("topo-1");
    expect(result!.nextTopoId).toBeNull();
  });

  it("middle topo: both prevTopoId and nextTopoId are set", async () => {
    const TOPO_3 = {
      id: "topo-3",
      boulderId: "boulder-1",
      name: "상단",
      baseImageUrl: "https://cdn/topos/topo-3.jpg",
      isPublished: true,
      sortOrder: 3,
    };
    vi.mocked(queries.getTopoById).mockResolvedValue({
      ...TOPO_2,
      boulder: BOULDER_1,
      sector: SECTOR_1,
      crag: CRAG_1,
    });
    vi.mocked(queries.boulderToposQuery).mockReturnValue(
      stubQuery([TOPO_1, TOPO_2, TOPO_3])
    );
    vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([]));

    const result = await findTopoById("topo-2");

    expect(result!.prevTopoId).toBe("topo-1");
    expect(result!.nextTopoId).toBe("topo-3");
  });

  it("single-topo boulder: both prevTopoId and nextTopoId are null", async () => {
    vi.mocked(queries.getTopoById).mockResolvedValue({
      ...TOPO_1,
      boulder: BOULDER_1,
      sector: SECTOR_1,
      crag: CRAG_1,
    });
    vi.mocked(queries.boulderToposQuery).mockReturnValue(stubQuery([TOPO_1]));
    vi.mocked(queries.topoRoutesQuery).mockReturnValue(stubQuery([]));

    const result = await findTopoById("topo-1");

    expect(result!.prevTopoId).toBeNull();
    expect(result!.nextTopoId).toBeNull();
    expect(result!.topoIndex).toBe(1);
    expect(result!.topoCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// findRouteById
// ---------------------------------------------------------------------------
describe("findRouteById", () => {
  it("returns null for unknown id", async () => {
    vi.mocked(queries.getRouteById).mockResolvedValue(null);

    expect(await findRouteById("missing")).toBeNull();
  });

  it("returns RouteListItem with full hierarchy for known id", async () => {
    vi.mocked(queries.getRouteById).mockResolvedValue(ROUTE_LIST_ITEM_1);

    const result = await findRouteById("route-1");
    expect(result).toMatchObject({
      id: "route-1",
      name: "Sky Hook",
      grade: "V5",
      boulderName: "큰바위",
      sectorName: "감자",
      cragName: "모락산",
    });
  });
});

// ---------------------------------------------------------------------------
// getAllRouteItems
// ---------------------------------------------------------------------------
describe("getAllRouteItems", () => {
  it("returns all published routes from the single flat query", async () => {
    vi.mocked(queries.getAllRouteItemsFlat).mockResolvedValue([
      ROUTE_LIST_ITEM_1,
    ]);

    const result = await getAllRouteItems();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("route-1");
    expect(vi.mocked(queries.getAllRouteItemsFlat)).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// parseBoulderHashtags
// ---------------------------------------------------------------------------
describe("parseBoulderHashtags", () => {
  it("parses a valid JSON array of strings", () => {
    expect(parseBoulderHashtags('["모락산", "슬랩"]')).toEqual(["모락산", "슬랩"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseBoulderHashtags("not json")).toEqual([]);
  });

  it("returns empty array when JSON is not an array", () => {
    expect(parseBoulderHashtags('{"key": "value"}')).toEqual([]);
  });

  it("filters out non-string entries in a mixed array", () => {
    expect(parseBoulderHashtags('[1, "valid", null, true]')).toEqual(["valid"]);
  });

  it("returns empty array for an empty JSON array", () => {
    expect(parseBoulderHashtags("[]")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findAreaDetailBySlug
// ---------------------------------------------------------------------------

const ZERO_GRADE_DIST = [
  { band: "V0-V2", min: 0, max: 2, count: 0 },
  { band: "V3-V5", min: 3, max: 5, count: 0 },
  { band: "V6-V8", min: 6, max: 8, count: 0 },
  { band: "V9-V11", min: 9, max: 11, count: 0 },
  { band: "V12+", min: 12, max: 99, count: 0 },
];

const GRADE_DIST_WITH_ROUTES = [
  { band: "V0-V2", min: 0, max: 2, count: 2 },
  { band: "V3-V5", min: 3, max: 5, count: 5 },
  { band: "V6-V8", min: 6, max: 8, count: 0 },
  { band: "V9-V11", min: 9, max: 11, count: 1 },
  { band: "V12+", min: 12, max: 99, count: 0 },
];

describe("findAreaDetailBySlug", () => {
  it("returns null when area slug does not exist", async () => {
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(null);

    const result = await findAreaDetailBySlug("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when getAreaBySlug returns null (unpublished or soft-deleted)", async () => {
    // getAreaBySlug itself filters is_published and deleted_at; null means not found/not accessible
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(null);

    expect(await findAreaDetailBySlug("unpublished-area")).toBeNull();
  });

  it("returns populated AreaDetail with stats, gradeDistribution, and crags", async () => {
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaStatsQuery).mockReturnValue(
      stubQuery({ crags: 2, sectors: 4, boulders: 8, routes: 20 })
    );
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(GRADE_DIST_WITH_ROUTES)
    );
    vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(
      stubQuery([CRAG_1, CRAG_2])
    );
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([
        { cragId: "crag-1", sectors: 2, boulders: 3, routes: 5 },
        { cragId: "crag-2", sectors: 2, boulders: 5, routes: 15 },
      ])
    );

    const result = await findAreaDetailBySlug("seoul");

    expect(result).not.toBeNull();
    // Area base fields preserved
    expect(result!.id).toBe("area-1");
    expect(result!.slug).toBe("seoul");
    expect(result!.name).toBe("수도권");
    // Stats
    expect(result!.stats).toEqual({ crags: 2, sectors: 4, boulders: 8, routes: 20 });
    // Grade distribution
    expect(result!.gradeDistribution).toEqual(GRADE_DIST_WITH_ROUTES);
    // Crags with per-crag stats
    expect(result!.crags).toHaveLength(2);
    expect(result!.crags[0]!.slug).toBe("moraksan");
    expect(result!.crags[0]!.stats).toEqual({ sectors: 2, boulders: 3, routes: 5 });
    expect(result!.crags[1]!.slug).toBe("anyang");
    expect(result!.crags[1]!.stats).toEqual({ sectors: 2, boulders: 5, routes: 15 });
  });

  it("returns gradeDistribution with all-zero counts when area has no routes", async () => {
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaStatsQuery).mockReturnValue(
      stubQuery({ crags: 1, sectors: 1, boulders: 1, routes: 0 })
    );
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(ZERO_GRADE_DIST)
    );
    vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(stubQuery([CRAG_1]));
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([{ cragId: "crag-1", sectors: 1, boulders: 1, routes: 0 }])
    );

    const result = await findAreaDetailBySlug("seoul");

    expect(result).not.toBeNull();
    expect(result!.gradeDistribution).toHaveLength(5);
    expect(result!.gradeDistribution.every((b) => b.count === 0)).toBe(true);
  });

  it("includes only published crags in crags list (cragsByAreaIdQuery handles the filter)", async () => {
    // cragsByAreaIdQuery already returns only published crags — we verify the
    // repository passes through whatever it returns.
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaStatsQuery).mockReturnValue(
      stubQuery({ crags: 1, sectors: 2, boulders: 3, routes: 5 })
    );
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(ZERO_GRADE_DIST)
    );
    vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(stubQuery([CRAG_1])); // only 1 published crag
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([{ cragId: "crag-1", sectors: 2, boulders: 3, routes: 5 }])
    );

    const result = await findAreaDetailBySlug("seoul");

    expect(result!.crags).toHaveLength(1);
    expect(result!.crags[0]!.slug).toBe("moraksan");
  });

  it("returns crags list as empty array when area has no published crags", async () => {
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(ZERO_GRADE_DIST)
    );
    // areaStatsQuery / cragsByAreaIdQuery keep their empty beforeEach defaults

    const result = await findAreaDetailBySlug("seoul");

    expect(result).not.toBeNull();
    expect(result!.crags).toHaveLength(0);
  });

  it("batches area stats, grade distribution, crags, coords, and per-crag stats after the slug lookup", async () => {
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(ZERO_GRADE_DIST)
    );
    vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(stubQuery([CRAG_1]));

    await findAreaDetailBySlug("seoul");

    expect(vi.mocked(queries.getAreaBySlug)).toHaveBeenCalledWith("seoul");
    expect(vi.mocked(queries.areaStatsQuery)).toHaveBeenCalledWith("area-1");
    expect(vi.mocked(queries.areaGradeDistributionQuery)).toHaveBeenCalledWith("area-1");
    expect(vi.mocked(queries.cragsByAreaIdQuery)).toHaveBeenCalledWith("area-1");
    expect(vi.mocked(queries.allCragStatsQuery)).toHaveBeenCalledWith("area-1");
    expect(vi.mocked(queries.areaCragsWithCoordsQuery)).toHaveBeenCalledWith("area-1");
  });

  it("returns cragLocations from getAreaCragsWithCoords in the result", async () => {
    const locations = [
      { id: "crag-1", slug: "moraksan", name: "모락산", lat: 37.4, lng: 127.0 },
      { id: "crag-2", slug: "anyang", name: "안양", lat: 37.39, lng: 126.95 },
    ];
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaStatsQuery).mockReturnValue(
      stubQuery({ crags: 2, sectors: 4, boulders: 8, routes: 20 })
    );
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(ZERO_GRADE_DIST)
    );
    vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(
      stubQuery([CRAG_1, CRAG_2])
    );
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([
        { cragId: "crag-1", sectors: 2, boulders: 3, routes: 5 },
        { cragId: "crag-2", sectors: 2, boulders: 5, routes: 15 },
      ])
    );
    vi.mocked(queries.areaCragsWithCoordsQuery).mockReturnValue(
      stubQuery(locations)
    );

    const result = await findAreaDetailBySlug("seoul");

    expect(result).not.toBeNull();
    expect(result!.cragLocations).toEqual(locations);
    expect(result!.cragLocations).toHaveLength(2);
  });

  it("returns cragLocations as empty array when no crags have coordinates", async () => {
    vi.mocked(queries.getAreaBySlug).mockResolvedValue(AREA_1);
    vi.mocked(queries.areaStatsQuery).mockReturnValue(
      stubQuery({ crags: 1, sectors: 1, boulders: 1, routes: 0 })
    );
    vi.mocked(queries.areaGradeDistributionQuery).mockReturnValue(
      stubQuery(ZERO_GRADE_DIST)
    );
    vi.mocked(queries.cragsByAreaIdQuery).mockReturnValue(stubQuery([CRAG_1]));
    vi.mocked(queries.allCragStatsQuery).mockReturnValue(
      stubQuery([{ cragId: "crag-1", sectors: 1, boulders: 1, routes: 0 }])
    );
    // areaCragsWithCoordsQuery already defaulted to [] by beforeEach

    const result = await findAreaDetailBySlug("seoul");

    expect(result).not.toBeNull();
    expect(result!.cragLocations).toEqual([]);
  });
});
