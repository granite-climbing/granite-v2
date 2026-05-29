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
  findRowBySlug,
} from "./admin-content-queries";
import { executeD1 } from "./d1-http";

vi.mock("./d1-http", () => ({
  executeD1: vi.fn(),
  queryD1First: vi.fn(),
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
});
