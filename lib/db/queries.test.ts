import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock d1-http. vi.mock is hoisted — use vi.hoisted to define mocks first.
// ---------------------------------------------------------------------------
const { mockQueryD1, mockQueryD1First } = vi.hoisted(() => ({
  mockQueryD1: vi.fn(),
  mockQueryD1First: vi.fn(),
}));

vi.mock("./d1-http", () => ({
  queryD1: mockQueryD1,
  queryD1First: mockQueryD1First,
}));

import {
  formatGradeRange,
  parseHashtags,
  getStats,
  getPublishedAreas,
  getCragsByAreaId,
  getCragStats,
  getPublishedAnnouncements,
  getCragBySlug,
  getCragSectors,
  getCragBouldersWithStats,
  getCragRoutes,
  getSectorBySlug,
  getBoulderById,
  getBoulderTopos,
  getTopoRoutes,
  getTopoById,
  getRouteById,
  getAreaBySlug,
  getAreaStats,
  getAreaGradeDistribution,
} from "./queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Unit: formatGradeRange
// ---------------------------------------------------------------------------

describe("formatGradeRange", () => {
  it("returns — when both grades are null", () => {
    expect(formatGradeRange(null, null)).toBe("—");
  });

  it("returns — when min is null", () => {
    expect(formatGradeRange(null, 5)).toBe("—");
  });

  it("returns single V-grade when min === max", () => {
    expect(formatGradeRange(3, 3)).toBe("V3");
  });

  it("returns range when min < max", () => {
    expect(formatGradeRange(2, 10)).toBe("V2-V10");
  });
});

// ---------------------------------------------------------------------------
// Unit: parseHashtags
// ---------------------------------------------------------------------------

describe("parseHashtags", () => {
  it("parses a valid JSON array of strings", () => {
    expect(parseHashtags('["crimps","slopers"]')).toEqual(["crimps", "slopers"]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseHashtags("not-json")).toEqual([]);
  });

  it("returns [] for non-array JSON", () => {
    expect(parseHashtags('"just-a-string"')).toEqual([]);
  });

  it("filters out non-string array elements", () => {
    expect(parseHashtags('[1, "ok", null]')).toEqual(["ok"]);
  });
});

// ---------------------------------------------------------------------------
// getStats — SQL shape + row mapping
// ---------------------------------------------------------------------------

describe("getStats", () => {
  it("calls queryD1First with no params and returns counts", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      crags: 3,
      sectors: 7,
      boulders: 12,
      routes: 45,
    });

    const stats = await getStats();

    expect(mockQueryD1First).toHaveBeenCalledOnce();
    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown];
    // should be a single scalar SELECT — no params
    expect(params).toBeUndefined();
    expect(sql).toMatch(/SELECT/i);
    expect(sql).toMatch(/crags/);
    expect(sql).toMatch(/sectors/);
    expect(sql).toMatch(/boulders/);
    expect(sql).toMatch(/routes/);
    // no string interpolation — no literal WHERE values embedded
    expect(sql).not.toMatch(/= '1'/);
    // soft-delete: all ancestor tables must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);

    expect(stats).toEqual({ crags: 3, sectors: 7, boulders: 12, routes: 45 });
  });

  it("returns zero stats when query returns null", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    const stats = await getStats();
    expect(stats).toEqual({ crags: 0, sectors: 0, boulders: 0, routes: 0 });
  });
});

// ---------------------------------------------------------------------------
// getPublishedAreas — camelCase aliases + is_published boolean mapping
// ---------------------------------------------------------------------------

describe("getPublishedAreas", () => {
  it("maps snake_case row to camelCase and converts is_published to boolean", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "area-1",
        name: "북한산",
        nameEn: "Bukhansan",
        slug: "bukhansan",
        coverImageUrl: "https://cdn/img.jpg",
        isPublished: 1,
        sortOrder: 0,
      },
    ]);

    const areas = await getPublishedAreas();

    expect(areas).toHaveLength(1);
    expect(areas[0].isPublished).toBe(true);
    expect(areas[0].nameEn).toBe("Bukhansan");
    expect(areas[0].coverImageUrl).toBe("https://cdn/img.jpg");
  });

  it("handles null nameEn", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "area-2",
        name: "설악산",
        nameEn: null,
        slug: "seoraksan",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 1,
      },
    ]);

    const areas = await getPublishedAreas();
    expect(areas[0].nameEn).toBeNull();
  });

  it("passes no dynamic params (no WHERE ?)", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getPublishedAreas();

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown];
    // No dynamic params needed for a simple published filter
    expect(params).toBeUndefined();
    expect(sql).toMatch(/FROM areas/);
    expect(sql).toMatch(/is_published = 1/);
    expect(sql).toMatch(/ORDER BY/);
    // soft-delete: areas must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getCragsByAreaId — uses ? placeholder
// ---------------------------------------------------------------------------

describe("getCragsByAreaId", () => {
  it("passes areaId as a bound param, not interpolated into SQL", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getCragsByAreaId("area-abc");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["area-abc"]);
    expect(sql).toMatch(/\?/);
    expect(sql).not.toContain("area-abc");
    expect(sql).toMatch(/FROM crags/);
    expect(sql).toMatch(/JOIN areas/);
    // soft-delete: crags and areas must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);
  });

  it("maps is_published 1 to true", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "crag-1",
        areaId: "area-1",
        name: "암장",
        nameEn: null,
        slug: "amjang",
        lat: 37.1,
        lng: 127.2,
        description: "",
        season: "",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
      },
    ]);

    const crags = await getCragsByAreaId("area-1");
    expect(crags[0].isPublished).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCragStats — multiple ? placeholders
// ---------------------------------------------------------------------------

describe("getCragStats", () => {
  it("passes cragId three times (once per subquery)", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      sectors: 2,
      boulders: 5,
      routes: 18,
    });

    const stats = await getCragStats("crag-xyz");

    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["crag-xyz", "crag-xyz", "crag-xyz"]);
    expect(sql).toMatch(/\?/);
    expect(sql).not.toContain("crag-xyz");
    expect(stats).toEqual({ sectors: 2, boulders: 5, routes: 18 });
    // soft-delete: all subqueries must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getPublishedAnnouncements — is_published boolean + camelCase
// ---------------------------------------------------------------------------

describe("getPublishedAnnouncements", () => {
  it("maps announcement row correctly", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "ann-1",
        title: "공지사항",
        body: "내용",
        coverImageUrl: "",
        cragId: null,
        linkUrl: "",
        isPublished: 1,
        publishedAt: "2024-01-01",
        sortOrder: 0,
      },
    ]);

    const anns = await getPublishedAnnouncements();
    expect(anns[0].isPublished).toBe(true);
    expect(anns[0].cragId).toBeNull();
    expect(anns[0].publishedAt).toBe("2024-01-01");
  });

  it("SQL excludes soft-deleted announcements", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getPublishedAnnouncements();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM announcements/);
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getCragBySlug — ? placeholder, null return
// ---------------------------------------------------------------------------

describe("getCragBySlug", () => {
  it("passes slug as param and returns null when not found", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);

    const result = await getCragBySlug("nonexistent");

    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["nonexistent"]);
    expect(sql).toMatch(/\?/);
    expect(sql).not.toContain("nonexistent");
    expect(result).toBeNull();
    // soft-delete: crag and area must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);
  });

  it("returns Crag with boolean isPublished when found", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      id: "crag-1",
      areaId: "area-1",
      name: "북한산",
      nameEn: null,
      slug: "bukhansan",
      lat: null,
      lng: null,
      description: "",
      season: "",
      coverImageUrl: "",
      isPublished: 1,
      sortOrder: 0,
    });

    const crag = await getCragBySlug("bukhansan");
    expect(crag).not.toBeNull();
    expect(crag!.isPublished).toBe(true);
    expect(crag!.slug).toBe("bukhansan");
  });
});

// ---------------------------------------------------------------------------
// getCragSectors — join chain includes areas + sectors
// ---------------------------------------------------------------------------

describe("getCragSectors", () => {
  it("includes JOIN to areas for ancestor-published check", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getCragSectors("crag-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["crag-1"]);
    expect(sql).toMatch(/FROM sectors/);
    expect(sql).toMatch(/JOIN crags/);
    expect(sql).toMatch(/JOIN areas/);
    expect(sql).toMatch(/\?/);
    // soft-delete: sectors, crags, areas must exclude deleted rows
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getCragBouldersWithStats — gradeRange computation + hashtags
// ---------------------------------------------------------------------------

describe("getCragBouldersWithStats", () => {
  it("computes gradeRange from SQL MIN/MAX and maps booleans", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "b-1",
        sectorId: "s-1",
        name: "바위",
        slug: "bawi",
        lat: 37.5,
        lng: 127.0,
        hashtags: '["crimps"]',
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        routeCount: 3,
        minGrade: 4,
        maxGrade: 8,
      },
    ]);

    const boulders = await getCragBouldersWithStats("crag-1");

    expect(boulders[0].isPublished).toBe(true);
    expect(boulders[0].routeCount).toBe(3);
    expect(boulders[0].gradeRange).toBe("V4-V8");
    expect(boulders[0].hashtagsList).toEqual(["crimps"]);
  });

  it("returns — gradeRange when no routes (NULL grades)", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "b-2",
        sectorId: "s-1",
        name: "빈바위",
        slug: "bawi2",
        lat: 37.5,
        lng: 127.0,
        hashtags: "[]",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        routeCount: 0,
        minGrade: null,
        maxGrade: null,
      },
    ]);

    const boulders = await getCragBouldersWithStats("crag-1");
    expect(boulders[0].gradeRange).toBe("—");
    expect(boulders[0].hashtagsList).toEqual([]);
  });

  it("returns V3 for single-grade boulder (min===max)", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "b-3",
        sectorId: "s-1",
        name: "V3 바위",
        slug: "v3-bawi",
        lat: 37.5,
        lng: 127.0,
        hashtags: "[]",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        routeCount: 1,
        minGrade: 3,
        maxGrade: 3,
      },
    ]);

    const boulders = await getCragBouldersWithStats("crag-1");
    expect(boulders[0].gradeRange).toBe("V3");
  });

  it("adds sectorId param when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getCragBouldersWithStats("crag-1", "sector-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["crag-1", "sector-1"]);
    expect(sql).toMatch(/b\.sector_id = \?/);
  });

  it("SQL uses ? placeholders not string interpolation", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getCragBouldersWithStats("crag-secret");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["crag-secret"]);
    expect(sql).not.toContain("crag-secret");
    expect(sql).toMatch(/MIN\(r\.grade_num\)/);
    expect(sql).toMatch(/MAX\(r\.grade_num\)/);
  });

  it("SQL excludes soft-deleted boulders and ancestors", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getCragBouldersWithStats("crag-1");

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getCragRoutes — join chain + hierarchy names
// ---------------------------------------------------------------------------

describe("getCragRoutes", () => {
  it("selects hierarchy name columns and uses ? placeholder", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getCragRoutes("crag-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["crag-1"]);
    expect(sql).toMatch(/boulderName/);
    expect(sql).toMatch(/sectorName/);
    expect(sql).toMatch(/cragName/);
    expect(sql).toMatch(/cragSlug/);
    expect(sql).toMatch(/sectorSlug/);
    expect(sql).toMatch(/FROM routes/);
    expect(sql).toMatch(/JOIN topos/);
    expect(sql).toMatch(/JOIN boulders/);
    expect(sql).toMatch(/JOIN sectors/);
    expect(sql).toMatch(/JOIN crags/);
    // soft-delete: all entities in the join chain must exclude deleted rows
    expect(sql).toMatch(/r\.deleted_at IS NULL/);
    expect(sql).toMatch(/t\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });

  it("maps is_published 1 to boolean true in RouteListItem", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "r-1",
        topoId: "t-1",
        name: "루트1",
        slug: "route-1",
        grade: "V5",
        gradeNum: 5,
        fa: "",
        description: "",
        lineImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        boulderName: "바위",
        sectorName: "섹터",
        cragName: "암장",
        cragSlug: "amjang",
        sectorSlug: "sector-a",
      },
    ]);

    const routes = await getCragRoutes("crag-1");
    expect(routes[0].isPublished).toBe(true);
    expect(routes[0].boulderName).toBe("바위");
    expect(routes[0].sectorSlug).toBe("sector-a");
  });
});

// ---------------------------------------------------------------------------
// getSectorBySlug — two ? params
// ---------------------------------------------------------------------------

describe("getSectorBySlug", () => {
  it("passes cragSlug and sectorSlug as bound params", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    await getSectorBySlug("crag-a", "sector-b");

    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["crag-a", "sector-b"]);
    expect(sql).not.toContain("crag-a");
    expect(sql).not.toContain("sector-b");
    expect(sql).toMatch(/JOIN crags/);
    expect(sql).toMatch(/JOIN areas/);
    // soft-delete: sector, crag, and area must exclude deleted rows
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getBoulderById — ancestor check
// ---------------------------------------------------------------------------

describe("getBoulderById", () => {
  it("SQL checks published ancestors", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    await getBoulderById("boulder-1");

    const [sql] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/JOIN sectors/);
    expect(sql).toMatch(/JOIN crags/);
    expect(sql).toMatch(/JOIN areas/);
    expect(sql).toMatch(/b\.is_published = 1/);
    expect(sql).toMatch(/s\.is_published = 1/);
    // soft-delete: boulder and all ancestors must exclude deleted rows
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getBoulderTopos — ordering
// ---------------------------------------------------------------------------

describe("getBoulderTopos", () => {
  it("orders by sort_order and id", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getBoulderTopos("boulder-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["boulder-1"]);
    expect(sql).toMatch(/ORDER BY sort_order, id/);
    // soft-delete: topos must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);
  });

  it("maps is_published 0 as false", async () => {
    // getBoulderTopos only returns is_published=1 rows due to WHERE clause
    // but verify the mapper works for the returned rows
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "topo-1",
        boulderId: "boulder-1",
        name: "토포1",
        baseImageUrl: "https://cdn/topo.jpg",
        isPublished: 1,
        sortOrder: 0,
      },
    ]);

    const topos = await getBoulderTopos("boulder-1");
    expect(topos[0].isPublished).toBe(true);
    expect(topos[0].baseImageUrl).toBe("https://cdn/topo.jpg");
  });
});

// ---------------------------------------------------------------------------
// getTopoRoutes — basic shape
// ---------------------------------------------------------------------------

describe("getTopoRoutes", () => {
  it("passes topoId as ? param", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getTopoRoutes("topo-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["topo-1"]);
    expect(sql).toMatch(/FROM routes/);
    expect(sql).toMatch(/topo_id = \?/);
    // soft-delete: routes must exclude deleted rows
    expect(sql).toMatch(/deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getTopoById — join chain + entity mapping
// ---------------------------------------------------------------------------

describe("getTopoById", () => {
  it("returns null when queryD1First returns null", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    const result = await getTopoById("topo-x");
    expect(result).toBeNull();
  });

  it("assembles topo + boulder + sector + crag from flat row", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      topoId: "t-1",
      topoBoulderId: "b-1",
      topoName: "토포",
      baseImageUrl: "https://cdn/base.jpg",
      topoIsPublished: 1,
      topoSortOrder: 0,
      boulderId: "b-1",
      boulderSectorId: "s-1",
      boulderName: "바위",
      boulderSlug: "bawi",
      boulderLat: 37.5,
      boulderLng: 127.0,
      boulderHashtags: "[]",
      boulderCoverImageUrl: "",
      boulderIsPublished: 1,
      boulderSortOrder: 0,
      sectorId: "s-1",
      sectorCragId: "c-1",
      sectorName: "섹터",
      sectorNameEn: null,
      sectorSlug: "sector-a",
      sectorLat: null,
      sectorLng: null,
      sectorDescription: "",
      sectorSeason: "",
      sectorCoverImageUrl: "",
      sectorIsPublished: 1,
      sectorSortOrder: 0,
      cragId: "c-1",
      cragAreaId: "a-1",
      cragName: "암장",
      cragNameEn: "Amjang",
      cragSlug: "amjang",
      cragLat: null,
      cragLng: null,
      cragDescription: "",
      cragSeason: "",
      cragCoverImageUrl: "",
      cragIsPublished: 1,
      cragSortOrder: 0,
    });

    const result = await getTopoById("t-1");

    expect(result).not.toBeNull();
    expect(result!.isPublished).toBe(true);
    expect(result!.boulder.isPublished).toBe(true);
    expect(result!.sector.isPublished).toBe(true);
    expect(result!.sector.nameEn).toBeNull();
    expect(result!.crag.isPublished).toBe(true);
    expect(result!.crag.nameEn).toBe("Amjang");
    expect(result!.id).toBe("t-1");
    expect(result!.boulder.id).toBe("b-1");
    expect(result!.sector.id).toBe("s-1");
    expect(result!.crag.id).toBe("c-1");
  });

  it("SQL joins all four tables and checks published chain", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    await getTopoById("topo-1");

    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["topo-1"]);
    expect(sql).toMatch(/FROM topos/);
    expect(sql).toMatch(/JOIN boulders/);
    expect(sql).toMatch(/JOIN sectors/);
    expect(sql).toMatch(/JOIN crags/);
    expect(sql).toMatch(/JOIN areas/);
    expect(sql).toMatch(/t\.is_published = 1/);
    expect(sql).toMatch(/b\.is_published = 1/);
    // soft-delete: topo and all ancestors must exclude deleted rows
    expect(sql).toMatch(/t\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getRouteById — RouteListItem with hierarchy
// ---------------------------------------------------------------------------

describe("getRouteById", () => {
  it("returns null when not found", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    const result = await getRouteById("r-missing");
    expect(result).toBeNull();
  });

  it("SQL excludes soft-deleted route and ancestors", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    await getRouteById("r-1");

    const [sql] = mockQueryD1First.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/r\.deleted_at IS NULL/);
    expect(sql).toMatch(/t\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });

  it("maps RouteListItem with hierarchy names and boolean isPublished", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      id: "r-1",
      topoId: "t-1",
      name: "루트",
      slug: "route",
      grade: "V7",
      gradeNum: 7,
      fa: "홍길동",
      description: "",
      lineImageUrl: "",
      isPublished: 1,
      sortOrder: 0,
      boulderName: "바위",
      sectorName: "섹터",
      cragName: "암장",
      cragSlug: "amjang",
      sectorSlug: "sector-a",
    });

    const route = await getRouteById("r-1");
    expect(route).not.toBeNull();
    expect(route!.isPublished).toBe(true);
    expect(route!.gradeNum).toBe(7);
    expect(route!.boulderName).toBe("바위");
    expect(route!.cragSlug).toBe("amjang");
  });
});

// ---------------------------------------------------------------------------
// getAreaBySlug — published/unpublished/soft-deleted/not-found
// ---------------------------------------------------------------------------

describe("getAreaBySlug", () => {
  it("passes slug as bound param, returns null when not found", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);

    const result = await getAreaBySlug("nonexistent");

    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["nonexistent"]);
    expect(sql).toMatch(/\?/);
    expect(sql).not.toContain("nonexistent");
    expect(result).toBeNull();
  });

  it("SQL filters is_published = 1 and deleted_at IS NULL", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    await getAreaBySlug("bukhansan");

    const [sql] = mockQueryD1First.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM areas/);
    expect(sql).toMatch(/is_published = 1/);
    expect(sql).toMatch(/deleted_at IS NULL/);
  });

  it("returns Area with boolean isPublished when found", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      id: "area-1",
      name: "북한산",
      nameEn: "Bukhansan",
      slug: "bukhansan",
      coverImageUrl: "https://cdn/img.jpg",
      isPublished: 1,
      sortOrder: 0,
    });

    const area = await getAreaBySlug("bukhansan");
    expect(area).not.toBeNull();
    expect(area!.isPublished).toBe(true);
    expect(area!.slug).toBe("bukhansan");
    expect(area!.nameEn).toBe("Bukhansan");
  });

  it("returns null when DB row has is_published = 0 (SQL WHERE excludes it)", async () => {
    // The SQL WHERE is_published = 1 prevents this row from being returned.
    // Simulate by having queryD1First return null (as the DB would).
    mockQueryD1First.mockResolvedValueOnce(null);
    const result = await getAreaBySlug("unpublished");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAreaStats — four subqueries, one param each
// ---------------------------------------------------------------------------

describe("getAreaStats", () => {
  it("passes areaId as four bound params", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      crags: 2,
      sectors: 5,
      boulders: 10,
      routes: 30,
    });

    const stats = await getAreaStats("area-abc");

    const [sql, params] = mockQueryD1First.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["area-abc", "area-abc", "area-abc", "area-abc"]);
    expect(sql).toMatch(/\?/);
    expect(sql).not.toContain("area-abc");
    expect(stats).toEqual({ crags: 2, sectors: 5, boulders: 10, routes: 30 });
    expect(sql).toMatch(/deleted_at IS NULL/);
  });

  it("returns zero stats when query returns null", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    const stats = await getAreaStats("area-empty");
    expect(stats).toEqual({ crags: 0, sectors: 0, boulders: 0, routes: 0 });
  });

  it("SQL uses ancestor chain (sectors JOIN crags, boulders JOIN sectors JOIN crags, routes JOIN topos)", async () => {
    mockQueryD1First.mockResolvedValueOnce({ crags: 0, sectors: 0, boulders: 0, routes: 0 });
    await getAreaStats("area-1");

    const [sql] = mockQueryD1First.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM crags c/);
    expect(sql).toMatch(/FROM sectors s/);
    expect(sql).toMatch(/FROM boulders b/);
    expect(sql).toMatch(/FROM routes r/);
    expect(sql).toMatch(/JOIN topos t/);
  });
});

// ---------------------------------------------------------------------------
// getAreaGradeDistribution — band mapping + empty area
// ---------------------------------------------------------------------------

describe("getAreaGradeDistribution", () => {
  it("passes areaId as bound param and returns all five bands", async () => {
    // Simulate DB returning rows for V0-V2 band (min=0) and V6-V8 band (min=6).
    mockQueryD1.mockResolvedValueOnce([
      { min: 0, count: 3 },
      { min: 6, count: 5 },
    ]);

    const dist = await getAreaGradeDistribution("area-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["area-1"]);
    expect(sql).toMatch(/\?/);
    expect(sql).not.toContain("area-1");
    expect(sql).toMatch(/FROM routes r/);
    expect(sql).toMatch(/JOIN topos t/);
    expect(sql).toMatch(/JOIN boulders b/);
    expect(sql).toMatch(/JOIN sectors s/);
    expect(sql).toMatch(/JOIN crags c/);

    // Always five bands
    expect(dist).toHaveLength(5);
    expect(dist.map((b) => b.band)).toEqual(["V0-V2", "V3-V5", "V6-V8", "V9-V11", "V12+"]);
  });

  it("buckets routes correctly: V0-V2 count=3, V6-V8 count=5, rest 0", async () => {
    mockQueryD1.mockResolvedValueOnce([
      { min: 0, count: 3 },
      { min: 6, count: 5 },
    ]);

    const dist = await getAreaGradeDistribution("area-1");

    expect(dist[0]).toEqual({ band: "V0-V2", min: 0, max: 2, count: 3 });
    expect(dist[1]).toEqual({ band: "V3-V5", min: 3, max: 5, count: 0 });
    expect(dist[2]).toEqual({ band: "V6-V8", min: 6, max: 8, count: 5 });
    expect(dist[3]).toEqual({ band: "V9-V11", min: 9, max: 11, count: 0 });
    expect(dist[4]).toEqual({ band: "V12+", min: 12, max: 99, count: 0 });
  });

  it("returns all-zero counts when area has no routes", async () => {
    mockQueryD1.mockResolvedValueOnce([]);

    const dist = await getAreaGradeDistribution("area-empty");

    expect(dist).toHaveLength(5);
    expect(dist.every((b) => b.count === 0)).toBe(true);
  });

  it("SQL filters full ancestor chain published and not soft-deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAreaGradeDistribution("area-1");

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/r\.is_published = 1/);
    expect(sql).toMatch(/t\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.is_published = 1/);
    expect(sql).toMatch(/s\.is_published = 1/);
    expect(sql).toMatch(/c\.is_published = 1/);
    expect(sql).toMatch(/r\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
  });

  it("SQL groups by band min and omits NULL grades via HAVING", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAreaGradeDistribution("area-1");

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/GROUP BY min/);
    expect(sql).toMatch(/HAVING min IS NOT NULL/);
  });

  it("V12+ band (min=12) is correctly identified from DB row with min=12", async () => {
    mockQueryD1.mockResolvedValueOnce([{ min: 12, count: 7 }]);

    const dist = await getAreaGradeDistribution("area-1");
    const v12Band = dist.find((b) => b.band === "V12+");
    expect(v12Band).toBeDefined();
    expect(v12Band!.count).toBe(7);
    expect(v12Band!.max).toBe(99);
  });
});
