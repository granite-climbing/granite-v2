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
  getAdminContentOverview,
  getAdminAreas,
  getAdminCrags,
  getAdminSectors,
  getAdminBoulders,
  getAdminTopos,
  getAdminRoutes,
  getAdminAnnouncements,
  getRecentAdminAuditLogs,
  listAreaOptions,
  listCragOptionsByArea,
  listSectorOptionsByCrag,
  listBoulderOptionsBySector,
  listTopoOptionsByBoulder,
} from "./admin-read-queries";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getAdminContentOverview
// ---------------------------------------------------------------------------

describe("getAdminContentOverview", () => {
  it("returns zero overview when DB returns null", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    const overview = await getAdminContentOverview();
    expect(overview).toBeDefined();
    // Should return a safe default
    expect(typeof overview.areas.total).toBe("number");
  });

  it("queries each entity table for published/draft/deleted counts", async () => {
    mockQueryD1First.mockResolvedValueOnce({
      areasPublished: 2,
      areasDraft: 1,
      areasDeleted: 0,
      cragsPublished: 5,
      cragsDraft: 2,
      cragsDeleted: 1,
      sectorsPublished: 10,
      sectorsDraft: 3,
      sectorsDeleted: 0,
      bouldersPublished: 20,
      bouldersDraft: 4,
      bouldersDeleted: 2,
      toposPublished: 30,
      toposDraft: 5,
      toposDeleted: 0,
      routesPublished: 100,
      routesDraft: 10,
      routesDeleted: 5,
      announcementsPublished: 3,
      announcementsDraft: 1,
      announcementsDeleted: 0,
    });

    const overview = await getAdminContentOverview();

    // Verify structure
    expect(overview.areas).toEqual({ published: 2, draft: 1, deleted: 0, total: 3 });
    expect(overview.crags).toEqual({ published: 5, draft: 2, deleted: 1, total: 8 });
    expect(overview.sectors).toEqual({ published: 10, draft: 3, deleted: 0, total: 13 });
    expect(overview.boulders).toEqual({ published: 20, draft: 4, deleted: 2, total: 26 });
    expect(overview.topos).toEqual({ published: 30, draft: 5, deleted: 0, total: 35 });
    expect(overview.routes).toEqual({ published: 100, draft: 10, deleted: 5, total: 115 });
    expect(overview.announcements).toEqual({ published: 3, draft: 1, deleted: 0, total: 4 });
  });

  it("SQL does NOT filter deleted or unpublished rows (all rows counted)", async () => {
    mockQueryD1First.mockResolvedValueOnce(null);
    await getAdminContentOverview();

    const [sql] = mockQueryD1First.mock.calls[0] as [string, unknown];
    // Should query all tables
    expect(sql).toMatch(/areas/);
    expect(sql).toMatch(/crags/);
    expect(sql).toMatch(/sectors/);
    expect(sql).toMatch(/boulders/);
    expect(sql).toMatch(/topos/);
    expect(sql).toMatch(/routes/);
    expect(sql).toMatch(/announcements/);
    // Must distinguish published vs draft vs deleted
    expect(sql).toMatch(/is_published/);
    expect(sql).toMatch(/deleted_at/);
  });
});

// ---------------------------------------------------------------------------
// getAdminAreas
// ---------------------------------------------------------------------------

describe("getAdminAreas", () => {
  it("returns all areas including unpublished and deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "area-1",
        name: "북한산",
        nameEn: "Bukhansan",
        slug: "bukhansan",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        deletedAt: null,
      },
      {
        id: "area-2",
        name: "삭제된 암장",
        nameEn: null,
        slug: "deleted-area",
        coverImageUrl: "",
        isPublished: 0,
        sortOrder: 1,
        deletedAt: "2025-01-01T00:00:00",
      },
    ]);

    const areas = await getAdminAreas();

    expect(areas).toHaveLength(2);
    expect(areas[0].isPublished).toBe(true);
    expect(areas[1].isPublished).toBe(false);
    expect(areas[1].deletedAt).toBe("2025-01-01T00:00:00");
  });

  it("SQL does NOT filter by is_published or deleted_at on areas", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminAreas();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM areas/);
    // Must not filter out unpublished or deleted areas
    expect(sql).not.toMatch(/is_published = 1/);
    expect(sql).not.toMatch(/deleted_at IS NULL/);
    // Must include deletedAt in SELECT
    expect(sql).toMatch(/deleted_at/);
  });

  it("orders by sort_order", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminAreas();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/ORDER BY/);
    expect(sql).toMatch(/sort_order/);
  });
});

// ---------------------------------------------------------------------------
// getAdminCrags
// ---------------------------------------------------------------------------

describe("getAdminCrags", () => {
  it("returns all crags including unpublished and self-deleted, but excludes orphaned (parent deleted)", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "crag-1",
        areaId: "area-1",
        areaName: "북한산",
        name: "인수봉",
        nameEn: null,
        slug: "insubong",
        lat: 37.65,
        lng: 126.98,
        description: "",
        season: "",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        deletedAt: null,
      },
    ]);

    const crags = await getAdminCrags();
    expect(crags).toHaveLength(1);
    expect(crags[0].areaName).toBe("북한산");
    expect(crags[0].isPublished).toBe(true);
    expect(crags[0].deletedAt).toBeNull();
  });

  it("SQL does NOT filter by c.is_published or c.deleted_at (crag rows not filtered)", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminCrags();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM crags/);
    expect(sql).toMatch(/JOIN areas/);
    // Crag itself: no filter on is_published or deleted_at
    expect(sql).not.toMatch(/c\.is_published = 1/);
    // But parent area must be not-deleted (exclude orphans)
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
    // Must include deleted_at in SELECT
    expect(sql).toMatch(/deleted_at/);
  });

  it("SQL orders by area sort_order then crag sort_order then name", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminCrags();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/a\.sort_order/);
    expect(sql).toMatch(/c\.sort_order/);
    expect(sql).toMatch(/c\.name/);
  });

  it("includes areaName from JOIN", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminCrags();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/areaName/);
  });
});

// ---------------------------------------------------------------------------
// getAdminSectors
// ---------------------------------------------------------------------------

describe("getAdminSectors", () => {
  it("returns all sectors including unpublished/deleted self rows", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "sector-1",
        cragId: "crag-1",
        cragName: "인수봉",
        cragSlug: "insubong",
        name: "섹터A",
        nameEn: null,
        slug: "sector-a",
        lat: null,
        lng: null,
        description: "",
        season: "",
        coverImageUrl: "",
        isPublished: 0,
        sortOrder: 0,
        deletedAt: null,
      },
    ]);

    const sectors = await getAdminSectors();
    expect(sectors).toHaveLength(1);
    expect(sectors[0].cragName).toBe("인수봉");
    expect(sectors[0].isPublished).toBe(false);
  });

  it("SQL does NOT filter s.is_published or s.deleted_at, but filters parent crag deleted_at", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM sectors/);
    expect(sql).toMatch(/JOIN crags/);
    // Sector itself not filtered
    expect(sql).not.toMatch(/s\.is_published = 1/);
    // Parent crag and area must not be deleted
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    // Must select deleted_at for the sector
    expect(sql).toMatch(/deleted_at/);
  });

  it("filters by cragId when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors("crag-42");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/\?/);
    expect(params).toContain("crag-42");
  });

  it("passes no params when no cragId provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors();

    const [, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(!params || params.length === 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAdminBoulders
// ---------------------------------------------------------------------------

describe("getAdminBoulders", () => {
  it("returns all boulders including unpublished/deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "boulder-1",
        sectorId: "sector-1",
        sectorName: "섹터A",
        cragName: "인수봉",
        cragSlug: "insubong",
        name: "바위1",
        slug: "bawi-1",
        lat: 37.0,
        lng: 127.0,
        hashtags: "[]",
        coverImageUrl: "",
        isPublished: 1,
        sortOrder: 0,
        deletedAt: null,
      },
    ]);

    const boulders = await getAdminBoulders();
    expect(boulders).toHaveLength(1);
    expect(boulders[0].sectorName).toBe("섹터A");
    expect(boulders[0].cragName).toBe("인수봉");
  });

  it("SQL does NOT filter b.is_published or b.deleted_at, but filters parent sector/crag deleted_at", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM boulders/);
    expect(sql).toMatch(/JOIN sectors/);
    expect(sql).toMatch(/JOIN crags/);
    // Boulder itself not filtered
    expect(sql).not.toMatch(/b\.is_published = 1/);
    // Parent must not be deleted
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    // Must include deleted_at in SELECT
    expect(sql).toMatch(/deleted_at/);
  });

  it("filters by sectorId when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders("sector-99");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/\?/);
    expect(params).toContain("sector-99");
  });
});

// ---------------------------------------------------------------------------
// getAdminTopos
// ---------------------------------------------------------------------------

describe("getAdminTopos", () => {
  it("returns all topos including unpublished/deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "topo-1",
        boulderId: "boulder-1",
        boulderName: "바위1",
        boulderSlug: "bawi-1",
        name: "토포1",
        baseImageUrl: "https://cdn/topo.jpg",
        isPublished: 0,
        sortOrder: 0,
        deletedAt: "2025-03-01T00:00:00",
      },
    ]);

    const topos = await getAdminTopos();
    expect(topos).toHaveLength(1);
    expect(topos[0].boulderName).toBe("바위1");
    expect(topos[0].isPublished).toBe(false);
    expect(topos[0].deletedAt).toBe("2025-03-01T00:00:00");
  });

  it("SQL does NOT filter t.is_published or t.deleted_at, but filters parent boulder deleted_at", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminTopos();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM topos/);
    expect(sql).toMatch(/JOIN boulders/);
    // Topo itself not filtered
    expect(sql).not.toMatch(/t\.is_published = 1/);
    // Parent boulder must not be deleted
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    // Must include deleted_at in SELECT
    expect(sql).toMatch(/deleted_at/);
  });

  it("filters by boulderId when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminTopos("boulder-5");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/\?/);
    expect(params).toContain("boulder-5");
  });
});

// ---------------------------------------------------------------------------
// getAdminRoutes
// ---------------------------------------------------------------------------

describe("getAdminRoutes", () => {
  it("returns all routes including unpublished/deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "route-1",
        topoId: "topo-1",
        topoName: "토포1",
        boulderName: "바위1",
        boulderSlug: "bawi-1",
        name: "루트1",
        slug: "route-1",
        grade: "V5",
        gradeNum: 5,
        fa: "",
        description: "",
        lineImageUrl: "",
        isPublished: 0,
        sortOrder: 0,
        deletedAt: null,
      },
    ]);

    const routes = await getAdminRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].topoName).toBe("토포1");
    expect(routes[0].boulderName).toBe("바위1");
    expect(routes[0].isPublished).toBe(false);
  });

  it("SQL does NOT filter r.is_published or r.deleted_at, but filters parent topo/boulder deleted_at", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminRoutes();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM routes/);
    expect(sql).toMatch(/JOIN topos/);
    expect(sql).toMatch(/JOIN boulders/);
    // Route itself not filtered
    expect(sql).not.toMatch(/r\.is_published = 1/);
    // Parent topo and boulder must not be deleted
    expect(sql).toMatch(/t\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    // Must include deleted_at in SELECT
    expect(sql).toMatch(/deleted_at/);
  });

  it("filters by topoId when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminRoutes("topo-7");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/\?/);
    expect(params).toContain("topo-7");
  });
});

// ---------------------------------------------------------------------------
// getAdminCrags — filter by areaId
// ---------------------------------------------------------------------------

describe("getAdminCrags — areaId filter", () => {
  it("passes areaId as a query param when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminCrags({ areaId: "area-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(params).toContain("area-1");
  });

  it("passes no extra params when no filter provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminCrags();

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).toMatch(/FROM crags/);
    expect(!params || params.length === 0).toBe(true);
  });

  it("still excludes crags whose parent area is deleted (a.deleted_at IS NULL)", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminCrags({ areaId: "area-1" });

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// getAdminSectors — filter by areaId + cragId
// ---------------------------------------------------------------------------

describe("getAdminSectors — areaId + cragId filters", () => {
  it("filters by areaId alone", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors({ areaId: "area-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(params).toContain("area-1");
    expect(params).not.toContain("crag-1");
  });

  it("filters by cragId alone", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors({ cragId: "crag-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(params).toContain("crag-1");
  });

  it("filters by both areaId AND cragId conjunctively", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors({ areaId: "area-1", cragId: "crag-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(params).toEqual(expect.arrayContaining(["area-1", "crag-1"]));
  });

  it("legacy string arg (cragId) is still supported", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors("crag-42");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(params).toContain("crag-42");
  });

  it("regression: filters by cragId alone without areaId", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminSectors({ cragId: "crag-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(sql).not.toMatch(/c\.area_id = \?/);
    expect(params).toEqual(["crag-1"]);
  });
});

// ---------------------------------------------------------------------------
// getAdminBoulders — filter by areaId, cragId, sectorId
// ---------------------------------------------------------------------------

describe("getAdminBoulders — multi-level filters", () => {
  it("filters by areaId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders({ areaId: "area-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(params).toContain("area-1");
  });

  it("filters by cragId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders({ cragId: "crag-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(params).toContain("crag-1");
  });

  it("filters by sectorId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders({ sectorId: "sector-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/b\.sector_id = \?/);
    expect(params).toContain("sector-1");
  });

  it("filters by all three combined", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders({ areaId: "area-1", cragId: "crag-1", sectorId: "sector-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(sql).toMatch(/b\.sector_id = \?/);
    expect(params).toEqual(expect.arrayContaining(["area-1", "crag-1", "sector-1"]));
  });

  it("legacy string arg (sectorId) is still supported", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminBoulders("sector-99");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/b\.sector_id = \?/);
    expect(params).toContain("sector-99");
  });
});

// ---------------------------------------------------------------------------
// getAdminTopos — filter by areaId, cragId, sectorId, boulderId
// ---------------------------------------------------------------------------

describe("getAdminTopos — multi-level filters", () => {
  it("filters by boulderId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminTopos({ boulderId: "boulder-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/t\.boulder_id = \?/);
    expect(params).toContain("boulder-1");
  });

  it("filters by sectorId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminTopos({ sectorId: "sector-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/b\.sector_id = \?/);
    expect(params).toContain("sector-1");
  });

  it("filters by all four combined", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminTopos({ areaId: "area-1", cragId: "crag-1", sectorId: "sector-1", boulderId: "boulder-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(sql).toMatch(/b\.sector_id = \?/);
    expect(sql).toMatch(/t\.boulder_id = \?/);
    expect(params).toEqual(expect.arrayContaining(["area-1", "crag-1", "sector-1", "boulder-1"]));
  });

  it("legacy string arg (boulderId) is still supported", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminTopos("boulder-5");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/t\.boulder_id = \?/);
    expect(params).toContain("boulder-5");
  });
});

// ---------------------------------------------------------------------------
// getAdminRoutes — filter by areaId, cragId, sectorId, boulderId, topoId
// ---------------------------------------------------------------------------

describe("getAdminRoutes — multi-level filters", () => {
  it("filters by topoId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminRoutes({ topoId: "topo-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/r\.topo_id = \?/);
    expect(params).toContain("topo-1");
  });

  it("filters by boulderId only", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminRoutes({ boulderId: "boulder-1" });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/t\.boulder_id = \?/);
    expect(params).toContain("boulder-1");
  });

  it("filters by all five combined", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminRoutes({
      areaId: "area-1",
      cragId: "crag-1",
      sectorId: "sector-1",
      boulderId: "boulder-1",
      topoId: "topo-1",
    });

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/c\.area_id = \?/);
    expect(sql).toMatch(/s\.crag_id = \?/);
    expect(sql).toMatch(/b\.sector_id = \?/);
    expect(sql).toMatch(/t\.boulder_id = \?/);
    expect(sql).toMatch(/r\.topo_id = \?/);
    expect(params).toEqual(
      expect.arrayContaining(["area-1", "crag-1", "sector-1", "boulder-1", "topo-1"])
    );
  });

  it("legacy string arg (topoId) is still supported", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminRoutes("topo-7");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/r\.topo_id = \?/);
    expect(params).toContain("topo-7");
  });
});

// ---------------------------------------------------------------------------
// Option-list queries
// ---------------------------------------------------------------------------

describe("listAreaOptions", () => {
  it("returns id+name, excludes soft-deleted, ordered by sort_order ASC, name ASC", async () => {
    mockQueryD1.mockResolvedValueOnce([
      { id: "area-1", name: "북한산" },
      { id: "area-2", name: "수락산" },
    ]);

    const opts = await listAreaOptions();
    expect(opts).toHaveLength(2);
    expect(opts[0]).toEqual({ id: "area-1", name: "북한산" });
  });

  it("SQL excludes deleted rows and orders correctly", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await listAreaOptions();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM areas/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/sort_order ASC/);
    expect(sql).toMatch(/name ASC/);
  });
});

describe("listCragOptionsByArea", () => {
  it("passes areaId as a param", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "crag-1", name: "인수봉" }]);
    await listCragOptionsByArea("area-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM crags/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(params).toContain("area-1");
  });

  it("returns empty array when no crags match (soft-deleted excluded)", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    const result = await listCragOptionsByArea("area-deleted");
    expect(result).toEqual([]);
  });

  it("with no areaId returns all live crags (no area_id condition)", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "c1", name: "C1" }]);

    const result = await listCragOptionsByArea();

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).not.toMatch(/c\.area_id = \?/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(sql).toMatch(/a\.deleted_at IS NULL/);
    expect(params).toBeUndefined();
    expect(result).toEqual([{ id: "c1", name: "C1" }]);
  });
});

describe("listSectorOptionsByCrag", () => {
  it("passes cragId as a param and excludes deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "sector-1", name: "섹터A" }]);
    await listSectorOptionsByCrag("crag-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM sectors/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(params).toContain("crag-1");
  });

  it("with no cragId returns all live sectors (no crag_id condition)", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "s1", name: "S1" }]);

    const result = await listSectorOptionsByCrag();

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).not.toMatch(/s\.crag_id = \?/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(sql).toMatch(/c\.deleted_at IS NULL/);
    expect(params).toBeUndefined();
    expect(result).toEqual([{ id: "s1", name: "S1" }]);
  });
});

describe("listBoulderOptionsBySector", () => {
  it("passes sectorId as a param and excludes deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "boulder-1", name: "바위1" }]);
    await listBoulderOptionsBySector("sector-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM boulders/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(params).toContain("sector-1");
  });

  it("with no sectorId returns all live boulders (no sector_id condition)", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "b1", name: "B1" }]);

    const result = await listBoulderOptionsBySector();

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).not.toMatch(/b\.sector_id = \?/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(sql).toMatch(/s\.deleted_at IS NULL/);
    expect(params).toBeUndefined();
    expect(result).toEqual([{ id: "b1", name: "B1" }]);
  });
});

describe("listTopoOptionsByBoulder", () => {
  it("passes boulderId as a param and excludes deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "topo-1", name: "정면" }]);
    await listTopoOptionsByBoulder("boulder-1");

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM topos/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(params).toContain("boulder-1");
  });

  it("returns empty array when boulder has no topos or they are all deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    const result = await listTopoOptionsByBoulder("empty-boulder");
    expect(result).toEqual([]);
  });

  it("with no boulderId returns all live topos (no boulder_id condition)", async () => {
    mockQueryD1.mockResolvedValueOnce([{ id: "t1", name: "T1" }]);

    const result = await listTopoOptionsByBoulder();

    const [sql, params] = mockQueryD1.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).not.toMatch(/t\.boulder_id = \?/);
    expect(sql).toMatch(/t\.deleted_at IS NULL/);
    expect(sql).toMatch(/b\.deleted_at IS NULL/);
    expect(params).toBeUndefined();
    expect(result).toEqual([{ id: "t1", name: "T1" }]);
  });
});

// ---------------------------------------------------------------------------
// getAdminAnnouncements
// ---------------------------------------------------------------------------

describe("getAdminAnnouncements", () => {
  it("returns all announcements including drafts and deleted", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "ann-1",
        title: "공지사항",
        body: "내용",
        coverImageUrl: "",
        cragId: null,
        linkUrl: "",
        isPublished: 0,
        publishedAt: "2025-01-01",
        sortOrder: 0,
        deletedAt: null,
      },
    ]);

    const anns = await getAdminAnnouncements();
    expect(anns).toHaveLength(1);
    expect(anns[0].isPublished).toBe(false);
    expect(anns[0].deletedAt).toBeNull();
  });

  it("SQL does NOT filter by is_published or deleted_at", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminAnnouncements();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM announcements/);
    expect(sql).not.toMatch(/is_published = 1/);
    expect(sql).not.toMatch(/deleted_at IS NULL/);
    // Must include deleted_at in SELECT
    expect(sql).toMatch(/deleted_at/);
  });

  it("orders by sort_order", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getAdminAnnouncements();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/ORDER BY/);
    expect(sql).toMatch(/sort_order/);
  });
});

// ---------------------------------------------------------------------------
// getRecentAdminAuditLogs
// ---------------------------------------------------------------------------

describe("getRecentAdminAuditLogs", () => {
  it("returns recent audit logs ordered by created_at DESC", async () => {
    mockQueryD1.mockResolvedValueOnce([
      {
        id: "log-1",
        adminId: "admin-1",
        adminEmail: "admin@example.com",
        action: "create_area",
        targetType: "area",
        targetId: "area-1",
        metadata: '{"name":"New Area"}',
        createdAt: "2025-03-01T12:00:00",
      },
      {
        id: "log-2",
        adminId: "admin-2",
        adminEmail: "admin2@example.com",
        action: "publish_crag",
        targetType: "crag",
        targetId: "crag-1",
        metadata: "{}",
        createdAt: "2025-03-01T11:00:00",
      },
    ]);

    const logs = await getRecentAdminAuditLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].adminEmail).toBe("admin@example.com");
    expect(logs[0].action).toBe("create_area");
    expect(logs[1].createdAt).toBe("2025-03-01T11:00:00");
  });

  it("SQL queries from admin_audit_logs with JOIN admins", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getRecentAdminAuditLogs();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/FROM admin_audit_logs/);
    expect(sql).toMatch(/JOIN admins/);
  });

  it("SQL orders by created_at DESC", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getRecentAdminAuditLogs();

    const [sql] = mockQueryD1.mock.calls[0] as [string, unknown];
    expect(sql).toMatch(/ORDER BY l\.created_at DESC/);
  });

  it("uses default limit of 100 when not provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getRecentAdminAuditLogs();

    const [, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([100]);
  });

  it("uses custom limit when provided", async () => {
    mockQueryD1.mockResolvedValueOnce([]);
    await getRecentAdminAuditLogs(50);

    const [, params] = mockQueryD1.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([50]);
  });
});
