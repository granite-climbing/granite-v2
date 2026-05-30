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
// Mock ./queries with small deterministic fixtures
// ---------------------------------------------------------------------------
vi.mock("./queries", () => ({
  // Stats
  getStats: vi.fn(),
  // Areas / crags
  getPublishedAreas: vi.fn(),
  getCragsByAreaId: vi.fn(),
  getCragStats: vi.fn(),
  // Announcements
  getPublishedAnnouncements: vi.fn(),
  // Crag detail
  getCragBySlug: vi.fn(),
  getCragSectors: vi.fn(),
  getCragBouldersWithStats: vi.fn(),
  getCragRoutes: vi.fn(),
  // Sector detail
  getSectorBySlug: vi.fn(),
  getSectorRoutes: vi.fn(),
  // Boulder detail
  getBoulderById: vi.fn(),
  getBoulderTopos: vi.fn(),
  getTopoRoutes: vi.fn(),
  // Topo detail
  getTopoById: vi.fn(),
  // Route detail
  getRouteById: vi.fn(),
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
import {
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
// Reset mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// getHomeModel
// ---------------------------------------------------------------------------
describe("getHomeModel", () => {
  it("composes totals, area stats, and crag stats from mocked queries", async () => {
    vi.mocked(queries.getStats).mockResolvedValue({
      crags: 2,
      sectors: 3,
      boulders: 4,
      routes: 7,
    });
    vi.mocked(queries.getPublishedAreas).mockResolvedValue([AREA_1]);
    vi.mocked(queries.getCragsByAreaId).mockResolvedValue([CRAG_1, CRAG_2]);
    vi.mocked(queries.getCragStats)
      .mockResolvedValueOnce({ sectors: 2, boulders: 3, routes: 5 }) // crag-1
      .mockResolvedValueOnce({ sectors: 1, boulders: 1, routes: 2 }); // crag-2
    vi.mocked(queries.getPublishedAnnouncements).mockResolvedValue([]);

    const model = await getHomeModel();

    // Global totals come directly from getStats()
    expect(model.totals).toEqual({ crags: 2, sectors: 3, boulders: 4, routes: 7 });

    // One area
    expect(model.areas).toHaveLength(1);
    const area = model.areas[0]!;
    expect(area.name).toBe("수도권");

    // Area stats = aggregate of both crags
    expect(area.stats).toEqual({
      crags: 2,
      sectors: 3,     // 2 + 1
      boulders: 4,    // 3 + 1
      routes: 7,      // 5 + 2
    });

    // Per-crag stats attached correctly
    expect(area.crags[0]!.stats).toEqual({ sectors: 2, boulders: 3, routes: 5 });
    expect(area.crags[1]!.stats).toEqual({ sectors: 1, boulders: 1, routes: 2 });
    expect(area.crags.map((c) => c.slug)).toEqual(["moraksan", "anyang"]);
  });

  it("returns empty areas/announcements arrays when nothing is published", async () => {
    vi.mocked(queries.getStats).mockResolvedValue({ crags: 0, sectors: 0, boulders: 0, routes: 0 });
    vi.mocked(queries.getPublishedAreas).mockResolvedValue([]);
    vi.mocked(queries.getCragsByAreaId).mockResolvedValue([]);
    vi.mocked(queries.getPublishedAnnouncements).mockResolvedValue([]);

    const model = await getHomeModel();
    expect(model.areas).toHaveLength(0);
    expect(model.announcements).toHaveLength(0);
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
    vi.mocked(queries.getCragSectors).mockResolvedValue([SECTOR_1]);
    vi.mocked(queries.getCragBouldersWithStats).mockResolvedValue([BOULDER_WITH_STATS]);
    vi.mocked(queries.getCragRoutes).mockResolvedValue([ROUTE_LIST_ITEM_1]);
    vi.mocked(queries.getCragStats).mockResolvedValue({ sectors: 1, boulders: 1, routes: 2 });

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
    vi.mocked(queries.getCragBySlug).mockResolvedValue(null);
    vi.mocked(queries.getSectorBySlug).mockResolvedValue(null);

    const result = await findSectorBySlug("nonexistent", "gamja");
    expect(result).toBeNull();
  });

  it("returns null when sector is not found", async () => {
    vi.mocked(queries.getCragBySlug).mockResolvedValue(CRAG_1);
    vi.mocked(queries.getSectorBySlug).mockResolvedValue(null);

    const result = await findSectorBySlug("moraksan", "nonexistent");
    expect(result).toBeNull();
  });

  it("returns populated SectorDetail", async () => {
    vi.mocked(queries.getCragBySlug).mockResolvedValue(CRAG_1);
    vi.mocked(queries.getSectorBySlug).mockResolvedValue(SECTOR_1);
    vi.mocked(queries.getCragBouldersWithStats).mockResolvedValue([BOULDER_WITH_STATS]);
    vi.mocked(queries.getSectorRoutes).mockResolvedValue([ROUTE_LIST_ITEM_1]);

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
    vi.mocked(queries.getBoulderById).mockResolvedValue(null);

    expect(await findBoulderById("missing")).toBeNull();
  });

  it("returns BoulderDetail with parsed hashtagsList and topos+routes", async () => {
    vi.mocked(queries.getBoulderById).mockResolvedValue(BOULDER_1);
    vi.mocked(queries.getBoulderTopos).mockResolvedValue([TOPO_1, TOPO_2]);
    vi.mocked(queries.getTopoRoutes)
      .mockResolvedValueOnce([ROUTE_1])  // topo-1
      .mockResolvedValueOnce([]);         // topo-2

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
    vi.mocked(queries.getBoulderTopos).mockResolvedValue([TOPO_1, TOPO_2]);
    vi.mocked(queries.getTopoRoutes).mockResolvedValue([ROUTE_1]);

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
    vi.mocked(queries.getBoulderTopos).mockResolvedValue([TOPO_1, TOPO_2]);
    vi.mocked(queries.getTopoRoutes).mockResolvedValue([]);

    const result = await findTopoById("topo-1");

    expect(result!.topoIndex).toBe(1);
    expect(result!.topoCount).toBe(2);
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
  it("aggregates routes across all published crags", async () => {
    vi.mocked(queries.getPublishedAreas).mockResolvedValue([AREA_1]);
    vi.mocked(queries.getCragsByAreaId).mockResolvedValue([CRAG_1, CRAG_2]);
    vi.mocked(queries.getCragRoutes)
      .mockResolvedValueOnce([ROUTE_LIST_ITEM_1])
      .mockResolvedValueOnce([]);

    const result = await getAllRouteItems();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("route-1");
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
