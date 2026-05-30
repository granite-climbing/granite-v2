import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  restoreContent,
  softDeleteContent,
  upsertCrag,
  updatePublishState,
  upsertArea,
  upsertSector,
  upsertBoulder,
  upsertTopo,
  upsertRoute,
  upsertAnnouncement,
  findRowBySlug,
  getCragSlugByCragId,
  getSectorAncestry,
  getBoulderAncestry,
  getTopoAncestry,
  getRouteAncestry,
  getSectorDescendantIds,
  getBoulderDescendantIds,
  getTopoDescendantIds,
} from "./admin-content-queries";
import { executeD1, queryD1First, queryD1 } from "./d1-http";

vi.mock("./d1-http", () => ({
  executeD1: vi.fn(),
  queryD1First: vi.fn(),
  queryD1: vi.fn(),
}));

const mockedExecute = vi.mocked(executeD1);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin content queries", () => {
  // -------------------------------------------------------------------------
  // Plan's 4 required tests
  // -------------------------------------------------------------------------

  it("upserts crags with Phase 2 columns", async () => {
    await upsertCrag({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      lat: 37.4194,
      lng: 126.9323,
      description: "desc",
      season: "spring",
      coverImageUrl: "https://cdn.granite.kr/crags/anyang/cover.webp",
      isPublished: true,
      sortOrder: 1,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crags"),
      expect.arrayContaining(["crag_anyang", "area_greater_seoul", "안양", "Anyang", "anyang", 1, 1]),
    );
  });

  it("updates publish state with a constrained table name", async () => {
    await updatePublishState({
      table: "routes",
      id: "route_anaconda",
      isPublished: false,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      "UPDATE routes SET is_published = ?, updated_at = datetime('now') WHERE id = ?",
      [0, "route_anaconda"],
    );
  });

  it("soft deletes routes by id", async () => {
    await softDeleteContent({ table: "routes", id: "route_anaconda" });

    expect(mockedExecute).toHaveBeenCalledWith(
      "UPDATE routes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      ["route_anaconda"],
    );
  });

  it("restores soft deleted content by id", async () => {
    await restoreContent({ table: "routes", id: "route_anaconda" });

    expect(mockedExecute).toHaveBeenCalledWith(
      "UPDATE routes SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?",
      ["route_anaconda"],
    );
  });

  // -------------------------------------------------------------------------
  // Table guard tests
  // -------------------------------------------------------------------------

  it("throws when updatePublishState is called with an invalid table", async () => {
    await expect(
      updatePublishState({ table: "admins" as never, id: "x", isPublished: true }),
    ).rejects.toThrow("Unsupported publish table: admins");
  });

  it("throws when softDeleteContent is called with an invalid table", async () => {
    await expect(
      softDeleteContent({ table: "admins" as never, id: "x" }),
    ).rejects.toThrow("Unsupported soft-delete table: admins");
  });

  it("throws when restoreContent is called with an invalid table", async () => {
    await expect(
      restoreContent({ table: "admins" as never, id: "x" }),
    ).rejects.toThrow("Unsupported restore table: admins");
  });

  // -------------------------------------------------------------------------
  // Other upsert functions
  // -------------------------------------------------------------------------

  it("upserts areas with all columns", async () => {
    await upsertArea({
      id: "area_1",
      name: "서울",
      nameEn: "Seoul",
      slug: "seoul",
      coverImageUrl: "https://cdn.granite.kr/areas/seoul/cover.webp",
      isPublished: true,
      sortOrder: 0,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO areas"),
      expect.arrayContaining(["area_1", "서울", "Seoul", "seoul", 1, 0]),
    );
  });

  it("upserts sectors with all columns", async () => {
    await upsertSector({
      id: "sector_1",
      cragId: "crag_1",
      name: "메인 섹터",
      nameEn: "Main Sector",
      slug: "main",
      lat: 37.5,
      lng: 127.0,
      description: "주요 볼더 섹터",
      season: "all",
      coverImageUrl: "https://cdn.granite.kr/sectors/main/cover.webp",
      isPublished: false,
      sortOrder: 1,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sectors"),
      expect.arrayContaining(["sector_1", "crag_1", "메인 섹터", "Main Sector", "main", 0, 1]),
    );
  });

  it("upserts boulders without name_en or description/season", async () => {
    await upsertBoulder({
      id: "boulder_1",
      sectorId: "sector_1",
      name: "아나콘다 블록",
      slug: "anaconda-block",
      lat: 37.5,
      lng: 127.0,
      hashtags: '["슬랩","크림프"]',
      coverImageUrl: "https://cdn.granite.kr/boulders/anaconda/cover.webp",
      isPublished: true,
      sortOrder: 0,
    });

    const call = mockedExecute.mock.calls[0];
    expect(call[0]).toContain("INSERT INTO boulders");
    // must include hashtags
    expect(call[1]).toContain('["슬랩","크림프"]');
    // must NOT include name_en (boulders has no such column)
    expect(call[0]).not.toContain("name_en");
    // must NOT include description or season (boulders has no such columns)
    expect(call[0]).not.toContain("description");
    expect(call[0]).not.toContain("season");
  });

  it("upserts topos with all columns", async () => {
    await upsertTopo({
      id: "topo_1",
      boulderId: "boulder_1",
      name: "Topo A",
      baseImageUrl: "https://cdn.granite.kr/topos/topo_a.webp",
      isPublished: true,
      sortOrder: 0,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO topos"),
      expect.arrayContaining(["topo_1", "boulder_1", "Topo A", 1, 0]),
    );
  });

  it("upserts routes without boulder_id", async () => {
    await upsertRoute({
      id: "route_1",
      topoId: "topo_1",
      name: "Anaconda",
      slug: "anaconda",
      grade: "V6",
      gradeNum: 6,
      fa: "Unknown",
      description: "Classic traverse",
      lineImageUrl: "https://cdn.granite.kr/routes/anaconda.webp",
      isPublished: true,
      sortOrder: 0,
    });

    const call = mockedExecute.mock.calls[0];
    expect(call[0]).toContain("INSERT INTO routes");
    // must NOT include boulder_id (routes has no such column)
    expect(call[0]).not.toContain("boulder_id");
    expect(call[1]).toContain("route_1");
    expect(call[1]).toContain("topo_1");
  });

  // -------------------------------------------------------------------------
  // Soft-delete vs UNIQUE(slug): findRowBySlug
  // -------------------------------------------------------------------------

  it("findRowBySlug issues correct query for a globally-unique slug table (crags)", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce({ id: "crag_old", deleted_at: "2026-01-01T00:00:00Z" });

    const result = await findRowBySlug({ table: "crags", slug: "anyang" });

    expect(mockedQuery).toHaveBeenCalledWith(
      "SELECT id, deleted_at FROM crags WHERE slug = ?",
      ["anyang"],
    );
    expect(result).toEqual({ id: "crag_old", deleted_at: "2026-01-01T00:00:00Z" });
  });

  it("findRowBySlug issues correct query for a parent-scoped slug table (sectors)", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce(null);

    const result = await findRowBySlug({ table: "sectors", slug: "main", parentColumn: "crag_id", parentId: "crag_1" });

    expect(mockedQuery).toHaveBeenCalledWith(
      "SELECT id, deleted_at FROM sectors WHERE slug = ? AND crag_id = ?",
      ["main", "crag_1"],
    );
    expect(result).toBeNull();
  });

  it("findRowBySlug returns null when the row does not exist", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce(null);

    const result = await findRowBySlug({ table: "crags", slug: "nonexistent" });

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Security: SQL injection protection for findRowBySlug
  // -------------------------------------------------------------------------

  it("findRowBySlug throws when table is invalid", async () => {
    await expect(
      findRowBySlug({ table: "admins" as never, slug: "test" }),
    ).rejects.toThrow("Unsupported findRowBySlug table: admins");
  });

  it("findRowBySlug throws when parentColumn is invalid (SQL injection attempt)", async () => {
    await expect(
      findRowBySlug({
        table: "sectors",
        slug: "s",
        parentColumn: "1=1; DROP TABLE crags",
        parentId: "x",
      }),
    ).rejects.toThrow("Unsupported parentColumn: 1=1; DROP TABLE crags");
  });

  it("findRowBySlug throws when parentColumn is not in allowlist", async () => {
    await expect(
      findRowBySlug({
        table: "sectors",
        slug: "s",
        parentColumn: "unknown_column",
        parentId: "x",
      }),
    ).rejects.toThrow("Unsupported parentColumn: unknown_column");
  });

  it("findRowBySlug accepts valid parentColumn values", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce(null);

    // Test all allowlisted parent columns
    const validColumns = ["area_id", "crag_id", "sector_id", "boulder_id", "topo_id"];
    for (const col of validColumns) {
      await findRowBySlug({
        table: "sectors",
        slug: "test",
        parentColumn: col,
        parentId: "parent_1",
      });
    }

    // Should have called queryD1First 5 times without throwing
    expect(mockedQuery).toHaveBeenCalledTimes(5);
  });

  // -------------------------------------------------------------------------
  // upsertAnnouncement
  // -------------------------------------------------------------------------

  it("upserts announcements with all columns", async () => {
    await upsertAnnouncement({
      id: "announcement_abc123",
      title: "이번 주 볼더링 이벤트",
      body: "자세한 내용은 인스타그램을 참고하세요.",
      coverImageUrl: "https://cdn.granite.kr/announcements/abc123/cover.webp",
      cragId: "crag_anyang",
      linkUrl: "https://instagram.com/granite.kr/posts/abc",
      isPublished: true,
      publishedAt: "2026-05-30T09:00:00Z",
      sortOrder: 1,
    });

    const call = mockedExecute.mock.calls[0];
    expect(call[0]).toContain("INSERT INTO announcements");
    expect(call[0]).toContain("ON CONFLICT(id) DO UPDATE SET");
    // Verify all 9 positional parameters are in the right order
    expect(call[1]).toEqual([
      "announcement_abc123",
      "이번 주 볼더링 이벤트",
      "자세한 내용은 인스타그램을 참고하세요.",
      "https://cdn.granite.kr/announcements/abc123/cover.webp",
      "crag_anyang",
      "https://instagram.com/granite.kr/posts/abc",
      1,
      "2026-05-30T09:00:00Z",
      1,
    ]);
  });

  it("upserts announcements with null cragId and empty fields", async () => {
    await upsertAnnouncement({
      id: "announcement_xyz",
      title: "공지사항",
      body: "",
      coverImageUrl: "",
      cragId: null,
      linkUrl: "",
      isPublished: false,
      publishedAt: "",
      sortOrder: 0,
    });

    const call = mockedExecute.mock.calls[0];
    expect(call[0]).toContain("INSERT INTO announcements");
    // cragId (index 4) should be null, isPublished (index 6) should be 0
    expect(call[1]![4]).toBeNull();
    expect(call[1]![6]).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Ancestry helpers (Task 17)
  // -------------------------------------------------------------------------

  it("getCragSlugByCragId: issues SELECT slug FROM crags WHERE id = ? with [id] params", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce({ slug: "anyang" });

    const result = await getCragSlugByCragId("crag_anyang");

    expect(mockedQuery).toHaveBeenCalledWith(
      "SELECT slug FROM crags WHERE id = ?",
      ["crag_anyang"],
    );
    expect(result).toBe("anyang");
  });

  it("getSectorAncestry: query JOINs sectors→crags and uses params [id]", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "anyang_antique" });

    const result = await getSectorAncestry("sector_anyang_antique");

    const [sql, params] = mockedQuery.mock.calls[mockedQuery.mock.calls.length - 1] as [string, unknown[]];
    expect(sql).toContain("JOIN crags");
    expect(sql).toContain("sectors");
    expect(params).toEqual(["sector_anyang_antique"]);
    expect(result).toEqual({ cragSlug: "anyang", sectorSlug: "anyang_antique" });
  });

  it("getBoulderAncestry: query JOINs boulders→sectors→crags and uses params [id]", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "anyang_antique" });

    const result = await getBoulderAncestry("boulder_gomul_boulder");

    const [sql, params] = mockedQuery.mock.calls[mockedQuery.mock.calls.length - 1] as [string, unknown[]];
    expect(sql).toContain("boulders");
    expect(sql).toContain("JOIN sectors");
    expect(sql).toContain("JOIN crags");
    expect(params).toEqual(["boulder_gomul_boulder"]);
    expect(result).toEqual({ cragSlug: "anyang", sectorSlug: "anyang_antique" });
  });

  it("getTopoAncestry: query JOINs topos→boulders→sectors→crags and uses params [id]", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder" });

    const result = await getTopoAncestry("topo_gomul_front");

    const [sql, params] = mockedQuery.mock.calls[mockedQuery.mock.calls.length - 1] as [string, unknown[]];
    expect(sql).toContain("topos");
    expect(sql).toContain("JOIN boulders");
    expect(sql).toContain("JOIN sectors");
    expect(sql).toContain("JOIN crags");
    expect(params).toEqual(["topo_gomul_front"]);
    expect(result).toEqual({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder" });
  });

  it("getRouteAncestry: query JOINs routes→topos→boulders→sectors→crags and uses params [id]", async () => {
    const { queryD1First: mockQueryD1First } = await import("./d1-http");
    const mockedQuery = vi.mocked(mockQueryD1First);
    mockedQuery.mockResolvedValueOnce({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder", topoId: "topo_gomul_front" });

    const result = await getRouteAncestry("route_anaconda");

    const [sql, params] = mockedQuery.mock.calls[mockedQuery.mock.calls.length - 1] as [string, unknown[]];
    expect(sql).toContain("routes");
    expect(sql).toContain("JOIN topos");
    expect(sql).toContain("JOIN boulders");
    expect(sql).toContain("JOIN sectors");
    expect(sql).toContain("JOIN crags");
    expect(params).toEqual(["route_anaconda"]);
    expect(result).toEqual({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder", topoId: "topo_gomul_front" });
  });

  // -------------------------------------------------------------------------
  // Descendant id helpers (Task 19)
  // -------------------------------------------------------------------------

  it("getSectorDescendantIds: issues 3 queries for boulders/topos/routes, uses params [sectorId], returns ids", async () => {
    const { queryD1: mockQueryD1 } = await import("./d1-http");
    const mockedQueryArr = vi.mocked(mockQueryD1);
    // boulders query → topos query → routes query
    mockedQueryArr
      .mockResolvedValueOnce([{ id: "b1" }, { id: "b2" }])
      .mockResolvedValueOnce([{ id: "t1" }])
      .mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]);

    const result = await getSectorDescendantIds("sector_x");

    // All three queries should have been called
    expect(mockedQueryArr).toHaveBeenCalledTimes(3);

    // boulders query: SELECT ... FROM boulders WHERE sector_id = ?
    const boulderCall = mockedQueryArr.mock.calls[0] as [string, unknown[]];
    expect(boulderCall[0]).toContain("boulders");
    expect(boulderCall[0]).toContain("sector_id");
    expect(boulderCall[1]).toEqual(["sector_x"]);

    // topos query: JOINs boulders → WHERE sector_id = ?
    const topoCall = mockedQueryArr.mock.calls[1] as [string, unknown[]];
    expect(topoCall[0]).toContain("topos");
    expect(topoCall[0]).toContain("boulders");
    expect(topoCall[1]).toEqual(["sector_x"]);

    // routes query: JOINs topos + boulders → WHERE sector_id = ?
    const routeCall = mockedQueryArr.mock.calls[2] as [string, unknown[]];
    expect(routeCall[0]).toContain("routes");
    expect(routeCall[0]).toContain("topos");
    expect(routeCall[0]).toContain("boulders");
    expect(routeCall[1]).toEqual(["sector_x"]);

    expect(result).toEqual({ boulderIds: ["b1", "b2"], topoIds: ["t1"], routeIds: ["r1", "r2"] });
  });

  it("getBoulderDescendantIds: issues 2 queries for topos/routes, uses params [boulderId], returns ids", async () => {
    const { queryD1: mockQueryD1 } = await import("./d1-http");
    const mockedQueryArr = vi.mocked(mockQueryD1);
    mockedQueryArr
      .mockResolvedValueOnce([{ id: "t1" }])
      .mockResolvedValueOnce([{ id: "r1" }]);

    const result = await getBoulderDescendantIds("boulder_gomul_boulder");

    expect(mockedQueryArr).toHaveBeenCalledTimes(2);

    // topos query: SELECT ... FROM topos WHERE boulder_id = ?
    const topoCall = mockedQueryArr.mock.calls[0] as [string, unknown[]];
    expect(topoCall[0]).toContain("topos");
    expect(topoCall[0]).toContain("boulder_id");
    expect(topoCall[1]).toEqual(["boulder_gomul_boulder"]);

    // routes query: JOINs topos → WHERE boulder_id = ?
    const routeCall = mockedQueryArr.mock.calls[1] as [string, unknown[]];
    expect(routeCall[0]).toContain("routes");
    expect(routeCall[0]).toContain("topos");
    expect(routeCall[1]).toEqual(["boulder_gomul_boulder"]);

    expect(result).toEqual({ topoIds: ["t1"], routeIds: ["r1"] });
  });

  it("getTopoDescendantIds: issues 1 query for routes, uses params [topoId], returns ids", async () => {
    const { queryD1: mockQueryD1 } = await import("./d1-http");
    const mockedQueryArr = vi.mocked(mockQueryD1);
    mockedQueryArr.mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]);

    const result = await getTopoDescendantIds("topo_gomul_front");

    expect(mockedQueryArr).toHaveBeenCalledTimes(1);

    const routeCall = mockedQueryArr.mock.calls[0] as [string, unknown[]];
    expect(routeCall[0]).toContain("routes");
    expect(routeCall[0]).toContain("topo_id");
    expect(routeCall[1]).toEqual(["topo_gomul_front"]);

    expect(result).toEqual({ routeIds: ["r1", "r2"] });
  });
});
