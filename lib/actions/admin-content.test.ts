import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseAreaForm,
  parseBoulderForm,
  parseCragForm,
  parseRouteForm,
  parseSectorForm,
  parseTopoForm,
} from "./admin-content-schema";
import { parseGradeNum } from "@/lib/db/import-normalize";

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports of the actions module)
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db/admin-queries", () => ({
  insertAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/admin-content-queries", () => ({
  upsertArea: vi.fn(),
  upsertCrag: vi.fn(),
  upsertSector: vi.fn(),
  upsertBoulder: vi.fn(),
  upsertTopo: vi.fn(),
  upsertRoute: vi.fn(),
  updatePublishState: vi.fn(),
  softDeleteContent: vi.fn(),
  restoreContent: vi.fn(),
  findRowBySlug: vi.fn(),
  getCragSlugByCragId: vi.fn(),
  getSectorAncestry: vi.fn(),
  getBoulderAncestry: vi.fn(),
  getTopoAncestry: vi.fn(),
  getRouteAncestry: vi.fn(),
  getSectorDescendantIds: vi.fn(),
  getBoulderDescendantIds: vi.fn(),
  getTopoDescendantIds: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Lazy imports after mocks are hoisted
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import {
  upsertCrag,
  upsertArea,
  upsertSector,
  upsertBoulder,
  upsertTopo,
  upsertRoute,
  updatePublishState,
  softDeleteContent,
  restoreContent,
  findRowBySlug,
  getCragSlugByCragId,
  getSectorAncestry,
  getBoulderAncestry,
  getTopoAncestry,
  getRouteAncestry,
  getSectorDescendantIds,
  getBoulderDescendantIds,
  getTopoDescendantIds,
} from "@/lib/db/admin-content-queries";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  saveCragAction,
  saveAreaAction,
  saveSectorAction,
  saveBoulderAction,
  saveTopoAction,
  saveRouteAction,
  softDeleteCragAction,
  softDeleteBoulderAction,
  softDeleteRouteAction,
  softDeleteSectorAction,
  restoreAreaAction,
  restoreCragAction,
  togglePublishAction,
} from "./admin-content";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedInsertAdminAuditLog = vi.mocked(insertAdminAuditLog);
const mockedUpsertCrag = vi.mocked(upsertCrag);
const mockedUpsertArea = vi.mocked(upsertArea);
const mockedUpsertSector = vi.mocked(upsertSector);
const mockedUpsertBoulder = vi.mocked(upsertBoulder);
const mockedUpsertTopo = vi.mocked(upsertTopo);
const mockedUpsertRoute = vi.mocked(upsertRoute);
const mockedUpdatePublishState = vi.mocked(updatePublishState);
const mockedSoftDeleteContent = vi.mocked(softDeleteContent);
const mockedRestoreContent = vi.mocked(restoreContent);
const mockedFindRowBySlug = vi.mocked(findRowBySlug);
const mockedGetCragSlugByCragId = vi.mocked(getCragSlugByCragId);
const mockedGetSectorAncestry = vi.mocked(getSectorAncestry);
const mockedGetBoulderAncestry = vi.mocked(getBoulderAncestry);
const mockedGetTopoAncestry = vi.mocked(getTopoAncestry);
const mockedGetRouteAncestry = vi.mocked(getRouteAncestry);
const mockedGetSectorDescendantIds = vi.mocked(getSectorDescendantIds);
const mockedGetBoulderDescendantIds = vi.mocked(getBoulderDescendantIds);
const mockedGetTopoDescendantIds = vi.mocked(getTopoDescendantIds);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRevalidateTag = vi.mocked(revalidateTag);

// ---------------------------------------------------------------------------
// Schema parse tests (Task 6) — kept as-is
// ---------------------------------------------------------------------------

describe("admin content form parsing", () => {
  it("parses crag fields matching Phase 2 schema", () => {
    const parsed = parseCragForm({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      description: "지하철 접근 가능",
      lat: "37.4194",
      lng: "126.9323",
      season: "2월 말 ~ 5월 말",
      coverImageUrl: "https://cdn.granite.kr/crags/anyang/cover.webp",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed).toMatchObject({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      description: "지하철 접근 가능",
      lat: 37.4194,
      lng: 126.9323,
      isPublished: true,
      sortOrder: 1,
    });
  });

  it("normalizes boulder hashtags into JSON text", () => {
    const parsed = parseBoulderForm({
      id: "boulder_gomul_boulder",
      sectorId: "sector_anyang_antique",
      name: "고물 볼더",
      slug: "gomul_boulder",
      lat: "37.423499",
      lng: "126.92643",
      hashtags: "#안양, 고물",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed.hashtags).toBe(JSON.stringify(["안양", "고물"]));
  });

  it("rejects routes without topo id", () => {
    expect(() =>
      parseRouteForm({
        id: "route_anaconda",
        topoId: "",
        name: "아나콘다",
        slug: "anaconda",
        grade: "V5",
        gradeNum: "5",
        fa: "",
        description: "",
        lineImageUrl: "",
        isPublished: "on",
        sortOrder: "1",
      }),
    ).toThrow();
  });

  it("parses area form happy path", () => {
    const parsed = parseAreaForm({
      id: "area_greater_seoul",
      name: "수도권",
      slug: "greater_seoul",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "0",
    });

    expect(parsed).toMatchObject({
      id: "area_greater_seoul",
      name: "수도권",
      slug: "greater_seoul",
      coverImageUrl: "",
      isPublished: true,
      sortOrder: 0,
    });
  });

  it("parses sector form happy path (uses cragId)", () => {
    const parsed = parseSectorForm({
      id: "sector_anyang_antique",
      cragId: "crag_anyang",
      name: "앤틱 구역",
      slug: "anyang_antique",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "0",
    });

    expect(parsed).toMatchObject({
      id: "sector_anyang_antique",
      cragId: "crag_anyang",
      name: "앤틱 구역",
      slug: "anyang_antique",
      isPublished: true,
      sortOrder: 0,
    });
  });

  it("parses topo form happy path", () => {
    const parsed = parseTopoForm({
      id: "topo_gomul_front",
      boulderId: "boulder_gomul_boulder",
      name: "고물 정면",
      baseImageUrl: "",
      isPublished: "on",
      sortOrder: "0",
    });

    expect(parsed).toMatchObject({
      id: "topo_gomul_front",
      boulderId: "boulder_gomul_boulder",
      name: "고물 정면",
      baseImageUrl: "",
      isPublished: true,
      sortOrder: 0,
    });
  });

  it("derives gradeNum from grade when gradeNum is blank", () => {
    const parsed = parseRouteForm({
      id: "route_anaconda",
      topoId: "topo_gomul_front",
      name: "아나콘다",
      slug: "anaconda",
      grade: "V5",
      gradeNum: "",
      fa: "",
      description: "",
      lineImageUrl: "",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed.gradeNum).toBe(parseGradeNum("V5"));
  });

  it("rejects crag form with R2 direct URL as coverImageUrl", () => {
    expect(() =>
      parseCragForm({
        id: "crag_anyang",
        areaId: "area_greater_seoul",
        name: "안양",
        slug: "anyang",
        coverImageUrl: "https://granite-v2.r2.cloudflarestorage.com/x.jpg",
        isPublished: "on",
        sortOrder: "0",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Action tests (Task 8)
// ---------------------------------------------------------------------------

describe("admin content actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid admin session
    mockedRequireAdmin.mockResolvedValue({
      adminId: "admin_1",
      email: "ops@granite.kr",
      displayName: "Ops",
    });
    // Default: no slug collision
    mockedFindRowBySlug.mockResolvedValue(null);
    // Default: all mutations succeed
    mockedUpsertCrag.mockResolvedValue(undefined);
    mockedUpsertArea.mockResolvedValue(undefined);
    mockedUpsertSector.mockResolvedValue(undefined);
    mockedUpsertBoulder.mockResolvedValue(undefined);
    mockedUpsertTopo.mockResolvedValue(undefined);
    mockedUpsertRoute.mockResolvedValue(undefined);
    mockedUpdatePublishState.mockResolvedValue(undefined);
    mockedSoftDeleteContent.mockResolvedValue(undefined);
    mockedRestoreContent.mockResolvedValue(undefined);
    mockedInsertAdminAuditLog.mockResolvedValue(undefined);
    // Default: ancestry helpers return null (actions gracefully skip optional tags)
    mockedGetCragSlugByCragId.mockResolvedValue(null);
    mockedGetSectorAncestry.mockResolvedValue(null);
    // Default: descendant helpers return empty sets
    mockedGetSectorDescendantIds.mockResolvedValue({ boulderIds: [], topoIds: [], routeIds: [] });
    mockedGetBoulderDescendantIds.mockResolvedValue({ topoIds: [], routeIds: [] });
    mockedGetTopoDescendantIds.mockResolvedValue({ routeIds: [] });
    mockedGetBoulderAncestry.mockResolvedValue(null);
    mockedGetTopoAncestry.mockResolvedValue(null);
    mockedGetRouteAncestry.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // saveCragAction
  // -------------------------------------------------------------------------

  it("saveCragAction: calls requireAdmin first, upserts crag with correct id, audits, revalidates", async () => {
    const formData = new FormData();
    formData.set("id", "crag_anyang");
    formData.set("areaId", "area_greater_seoul");
    formData.set("name", "안양");
    formData.set("nameEn", "Anyang");
    formData.set("slug", "anyang");
    formData.set("description", "desc");
    formData.set("season", "spring");
    formData.set("coverImageUrl", "https://cdn.granite.kr/crags/anyang/cover.webp");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");

    await saveCragAction(formData);

    // requireAdmin must be called (and before any mutation)
    expect(mockedRequireAdmin).toHaveBeenCalled();

    // upsert called with correct id
    expect(mockedUpsertCrag).toHaveBeenCalledWith(expect.objectContaining({ id: "crag_anyang" }));

    // audit written with correct fields
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "content.upsert",
        targetType: "crag",
        targetId: "crag_anyang",
      }),
    );

    // cache invalidation
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("saveCragAction: generates id from slug when no id provided", async () => {
    const formData = new FormData();
    // no id
    formData.set("areaId", "area_greater_seoul");
    formData.set("name", "안양");
    formData.set("slug", "anyang");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveCragAction(formData);

    expect(mockedFindRowBySlug).toHaveBeenCalledWith(
      expect.objectContaining({ table: "crags", slug: "anyang" }),
    );
    expect(mockedUpsertCrag).toHaveBeenCalledWith(expect.objectContaining({ id: "crag_anyang" }));
  });

  // -------------------------------------------------------------------------
  // Slug collision: live row → throws
  // -------------------------------------------------------------------------

  it("saveCragAction: throws 'Slug already in use' when live row exists", async () => {
    mockedFindRowBySlug.mockResolvedValue({ id: "crag_anyang", deleted_at: null });

    const formData = new FormData();
    formData.set("areaId", "area_greater_seoul");
    formData.set("name", "안양 복사본");
    formData.set("slug", "anyang");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await expect(saveCragAction(formData)).rejects.toThrow("Slug already in use");
    expect(mockedUpsertCrag).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Slug collision: soft-deleted row → reuse + restore
  // -------------------------------------------------------------------------

  it("saveCragAction: reuses soft-deleted row id and calls restoreContent", async () => {
    mockedFindRowBySlug.mockResolvedValue({ id: "crag_old_id", deleted_at: "2025-01-01 00:00:00" });

    const formData = new FormData();
    formData.set("areaId", "area_greater_seoul");
    formData.set("name", "안양");
    formData.set("slug", "anyang");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveCragAction(formData);

    // Should use the existing deleted row's id
    expect(mockedUpsertCrag).toHaveBeenCalledWith(expect.objectContaining({ id: "crag_old_id" }));
    // Should restore it
    expect(mockedRestoreContent).toHaveBeenCalledWith({ table: "crags", id: "crag_old_id" });
  });

  // -------------------------------------------------------------------------
  // Fresh create regression tests: restoreContent should NOT be called
  // -------------------------------------------------------------------------

  it("saveSectorAction: fresh create does NOT call restoreContent", async () => {
    mockedFindRowBySlug.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    // Upsert must be called
    expect(mockedUpsertSector).toHaveBeenCalled();
    // restoreContent should NOT be called for fresh create
    expect(mockedRestoreContent).not.toHaveBeenCalled();
  });

  it("saveBoulderAction: fresh create does NOT call restoreContent", async () => {
    mockedFindRowBySlug.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("sectorId", "sector_anyang_antique");
    formData.set("name", "고물 볼더");
    formData.set("slug", "gomul_boulder");
    formData.set("lat", "37.42");
    formData.set("lng", "126.92");
    formData.set("hashtags", "");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveBoulderAction(formData);

    // Upsert must be called
    expect(mockedUpsertBoulder).toHaveBeenCalled();
    // restoreContent should NOT be called for fresh create
    expect(mockedRestoreContent).not.toHaveBeenCalled();
  });

  it("saveRouteAction: fresh create does NOT call restoreContent", async () => {
    mockedFindRowBySlug.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("topoId", "topo_gomul_front");
    formData.set("name", "아나콘다");
    formData.set("slug", "anaconda");
    formData.set("grade", "V5");
    formData.set("gradeNum", "5");
    formData.set("fa", "");
    formData.set("description", "");
    formData.set("lineImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");

    await saveRouteAction(formData);

    // Upsert must be called
    expect(mockedUpsertRoute).toHaveBeenCalled();
    // restoreContent should NOT be called for fresh create
    expect(mockedRestoreContent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // saveAreaAction
  // -------------------------------------------------------------------------

  it("saveAreaAction: calls requireAdmin, upserts area, audits, revalidates areas:list + home", async () => {
    const formData = new FormData();
    formData.set("id", "area_greater_seoul");
    formData.set("name", "수도권");
    formData.set("slug", "greater_seoul");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveAreaAction(formData);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedUpsertArea).toHaveBeenCalledWith(expect.objectContaining({ id: "area_greater_seoul" }));
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content.upsert", targetType: "area" }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("areas:list");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });

  // -------------------------------------------------------------------------
  // saveSectorAction
  // -------------------------------------------------------------------------

  it("saveSectorAction: uses crag_id scope for slug collision check", async () => {
    const formData = new FormData();
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    expect(mockedFindRowBySlug).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "sectors",
        slug: "anyang_antique",
        parentColumn: "crag_id",
        parentId: "crag_anyang",
      }),
    );
    expect(mockedUpsertSector).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^sector_/) }),
    );
  });

  // -------------------------------------------------------------------------
  // saveBoulderAction
  // -------------------------------------------------------------------------

  it("saveBoulderAction: upserts boulder with sector_id scope", async () => {
    const formData = new FormData();
    formData.set("sectorId", "sector_anyang_antique");
    formData.set("name", "고물 볼더");
    formData.set("slug", "gomul_boulder");
    formData.set("lat", "37.42");
    formData.set("lng", "126.92");
    formData.set("hashtags", "");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveBoulderAction(formData);

    expect(mockedFindRowBySlug).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "boulders",
        slug: "gomul_boulder",
        parentColumn: "sector_id",
        parentId: "sector_anyang_antique",
      }),
    );
    expect(mockedUpsertBoulder).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^boulder_/) }),
    );
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content.upsert", targetType: "boulder" }),
    );
  });

  // -------------------------------------------------------------------------
  // saveRouteAction
  // -------------------------------------------------------------------------

  it("saveRouteAction: upserts route with topo_id scope", async () => {
    const formData = new FormData();
    formData.set("topoId", "topo_gomul_front");
    formData.set("name", "아나콘다");
    formData.set("slug", "anaconda");
    formData.set("grade", "V5");
    formData.set("gradeNum", "5");
    formData.set("fa", "");
    formData.set("description", "");
    formData.set("lineImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");

    await saveRouteAction(formData);

    expect(mockedFindRowBySlug).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "routes",
        slug: "anaconda",
        parentColumn: "topo_id",
        parentId: "topo_gomul_front",
      }),
    );
    expect(mockedUpsertRoute).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^route_/) }),
    );
  });

  // -------------------------------------------------------------------------
  // Parent-scoped id collision regression tests
  // -------------------------------------------------------------------------

  it("saveSectorAction: generates different UUIDs for same slug under different crags (collision regression)", async () => {
    mockedFindRowBySlug.mockResolvedValue(null);

    // First call: create sector with slug "anyang" under crag_a
    const formData1 = new FormData();
    formData1.set("cragId", "crag_a");
    formData1.set("name", "Sector A");
    formData1.set("slug", "anyang");
    formData1.set("coverImageUrl", "");
    formData1.set("isPublished", "on");
    formData1.set("sortOrder", "0");

    await saveSectorAction(formData1);

    const call1 = mockedUpsertSector.mock.calls[0];
    const id1 = call1?.[0]?.id;

    // Reset mock for second call
    mockedUpsertSector.mockClear();
    mockedFindRowBySlug.mockClear();
    mockedFindRowBySlug.mockResolvedValue(null);

    // Second call: create sector with same slug "anyang" under crag_b
    const formData2 = new FormData();
    formData2.set("cragId", "crag_b");
    formData2.set("name", "Sector B");
    formData2.set("slug", "anyang");
    formData2.set("coverImageUrl", "");
    formData2.set("isPublished", "on");
    formData2.set("sortOrder", "0");

    await saveSectorAction(formData2);

    const call2 = mockedUpsertSector.mock.calls[0];
    const id2 = call2?.[0]?.id;

    // Verify both ids match the prefix
    expect(id1).toMatch(/^sector_/);
    expect(id2).toMatch(/^sector_/);
    // Verify they are different (UUID prevents collision)
    expect(id1).not.toBe(id2);
    // Verify upsertSector was called twice total (once per call)
    expect(mockedUpsertSector).toHaveBeenCalledTimes(1); // This call's upserts
  });

  it("saveBoulderAction: generates different UUIDs for same slug under different sectors (collision regression)", async () => {
    mockedFindRowBySlug.mockResolvedValue(null);

    // First call: create boulder with slug "gomul" under sector_a
    const formData1 = new FormData();
    formData1.set("sectorId", "sector_a");
    formData1.set("name", "Boulder A");
    formData1.set("slug", "gomul");
    formData1.set("lat", "37.42");
    formData1.set("lng", "126.92");
    formData1.set("hashtags", "");
    formData1.set("coverImageUrl", "");
    formData1.set("isPublished", "on");
    formData1.set("sortOrder", "0");

    await saveBoulderAction(formData1);

    const call1 = mockedUpsertBoulder.mock.calls[0];
    const id1 = call1?.[0]?.id;

    // Reset mock for second call
    mockedUpsertBoulder.mockClear();
    mockedFindRowBySlug.mockClear();
    mockedFindRowBySlug.mockResolvedValue(null);

    // Second call: create boulder with same slug "gomul" under sector_b
    const formData2 = new FormData();
    formData2.set("sectorId", "sector_b");
    formData2.set("name", "Boulder B");
    formData2.set("slug", "gomul");
    formData2.set("lat", "37.42");
    formData2.set("lng", "126.92");
    formData2.set("hashtags", "");
    formData2.set("coverImageUrl", "");
    formData2.set("isPublished", "on");
    formData2.set("sortOrder", "0");

    await saveBoulderAction(formData2);

    const call2 = mockedUpsertBoulder.mock.calls[0];
    const id2 = call2?.[0]?.id;

    // Verify both ids match the prefix
    expect(id1).toMatch(/^boulder_/);
    expect(id2).toMatch(/^boulder_/);
    // Verify they are different (UUID prevents collision)
    expect(id1).not.toBe(id2);
    // Verify upsertBoulder was called twice total (once per call)
    expect(mockedUpsertBoulder).toHaveBeenCalledTimes(1); // This call's upserts
  });

  it("saveRouteAction: generates different UUIDs for same slug under different topos (collision regression)", async () => {
    mockedFindRowBySlug.mockResolvedValue(null);

    // First call: create route with slug "anaconda" under topo_a
    const formData1 = new FormData();
    formData1.set("topoId", "topo_a");
    formData1.set("name", "Route A");
    formData1.set("slug", "anaconda");
    formData1.set("grade", "V5");
    formData1.set("gradeNum", "5");
    formData1.set("fa", "");
    formData1.set("description", "");
    formData1.set("lineImageUrl", "");
    formData1.set("isPublished", "on");
    formData1.set("sortOrder", "1");

    await saveRouteAction(formData1);

    const call1 = mockedUpsertRoute.mock.calls[0];
    const id1 = call1?.[0]?.id;

    // Reset mock for second call
    mockedUpsertRoute.mockClear();
    mockedFindRowBySlug.mockClear();
    mockedFindRowBySlug.mockResolvedValue(null);

    // Second call: create route with same slug "anaconda" under topo_b
    const formData2 = new FormData();
    formData2.set("topoId", "topo_b");
    formData2.set("name", "Route B");
    formData2.set("slug", "anaconda");
    formData2.set("grade", "V5");
    formData2.set("gradeNum", "5");
    formData2.set("fa", "");
    formData2.set("description", "");
    formData2.set("lineImageUrl", "");
    formData2.set("isPublished", "on");
    formData2.set("sortOrder", "1");

    await saveRouteAction(formData2);

    const call2 = mockedUpsertRoute.mock.calls[0];
    const id2 = call2?.[0]?.id;

    // Verify both ids match the prefix
    expect(id1).toMatch(/^route_/);
    expect(id2).toMatch(/^route_/);
    // Verify they are different (UUID prevents collision)
    expect(id1).not.toBe(id2);
    // Verify upsertRoute was called twice total (once per call)
    expect(mockedUpsertRoute).toHaveBeenCalledTimes(1); // This call's upserts
  });

  // -------------------------------------------------------------------------
  // Soft-delete actions
  // -------------------------------------------------------------------------

  it("softDeleteCragAction: calls softDeleteContent, audits content.soft_delete, revalidates", async () => {
    const formData = new FormData();
    formData.set("id", "crag_anyang");
    formData.set("slug", "anyang");
    formData.set("confirm", "DELETE");

    await softDeleteCragAction(formData);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedSoftDeleteContent).toHaveBeenCalledWith({ table: "crags", id: "crag_anyang" });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "content.soft_delete",
        targetType: "crag",
        targetId: "crag_anyang",
      }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("softDeleteBoulderAction: calls softDeleteContent with boulders table, revalidates boulder tag", async () => {
    const formData = new FormData();
    formData.set("id", "boulder_gomul_boulder");
    formData.set("confirm", "DELETE");

    await softDeleteBoulderAction(formData);

    expect(mockedSoftDeleteContent).toHaveBeenCalledWith({ table: "boulders", id: "boulder_gomul_boulder" });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content.soft_delete", targetType: "boulder" }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_gomul_boulder");
  });

  // -------------------------------------------------------------------------
  // Restore actions
  // -------------------------------------------------------------------------

  it("restoreCragAction: calls restoreContent, audits content.restore, revalidates", async () => {
    const formData = new FormData();
    formData.set("id", "crag_anyang");
    formData.set("slug", "anyang");

    await restoreCragAction(formData);

    expect(mockedRestoreContent).toHaveBeenCalledWith({ table: "crags", id: "crag_anyang" });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content.restore", targetType: "crag", targetId: "crag_anyang" }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  // -------------------------------------------------------------------------
  // togglePublishAction
  // -------------------------------------------------------------------------

  it("togglePublishAction: calls updatePublishState, audits content.publish_toggle with singular targetType, revalidates", async () => {
    // Action uses DB to resolve cragSlug for crags table
    mockedGetCragSlugByCragId.mockResolvedValue("anyang");

    const formData = new FormData();
    formData.set("table", "crags");
    formData.set("id", "crag_anyang");
    formData.set("isPublished", "on");

    await togglePublishAction(formData);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedUpdatePublishState).toHaveBeenCalledWith(
      expect.objectContaining({ table: "crags", id: "crag_anyang", isPublished: true }),
    );
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "content.publish_toggle",
        targetType: "crag",
        targetId: "crag_anyang",
      }),
    );
    // crag toggle now fires crag-surface tags
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("togglePublishAction: throws 'Unsupported table' when table not in allowlist", async () => {
    const formData = new FormData();
    formData.set("table", "invalid_table");
    formData.set("id", "some_id");
    formData.set("isPublished", "on");

    await expect(togglePublishAction(formData)).rejects.toThrow("Unsupported table: invalid_table");
    expect(mockedUpdatePublishState).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Soft-delete confirm guard
  // -------------------------------------------------------------------------

  it("softDeleteCragAction: throws when confirm field is missing", async () => {
    const formData = new FormData();
    formData.set("id", "crag_anyang");
    // No confirm field

    await expect(softDeleteCragAction(formData)).rejects.toThrow(/"DELETE"/);
    expect(mockedSoftDeleteContent).not.toHaveBeenCalled();
  });

  it("softDeleteCragAction: throws when confirm field is not 'DELETE'", async () => {
    const formData = new FormData();
    formData.set("id", "crag_anyang");
    formData.set("confirm", "delete");

    await expect(softDeleteCragAction(formData)).rejects.toThrow(/"DELETE"/);
    expect(mockedSoftDeleteContent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Non-fatal audit: audit failure does not surface as action failure
  // -------------------------------------------------------------------------

  it("audit failure does not throw — mutation still committed", async () => {
    mockedInsertAdminAuditLog.mockRejectedValueOnce(new Error("DB connection failed"));

    const formData = new FormData();
    formData.set("id", "crag_anyang");
    formData.set("areaId", "area_greater_seoul");
    formData.set("name", "안양");
    formData.set("nameEn", "Anyang");
    formData.set("slug", "anyang");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");

    // Action must NOT throw even though audit insert fails
    await expect(saveCragAction(formData)).resolves.toBeUndefined();

    // The content mutation still ran
    expect(mockedUpsertCrag).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // requireAdmin is called before any mutation
  // -------------------------------------------------------------------------

  it("softDeleteCragAction: mutation is NOT called when requireAdmin throws", async () => {
    mockedRequireAdmin.mockRejectedValueOnce(new Error("Unauthorized"));

    const formData = new FormData();
    formData.set("id", "crag_anyang");
    formData.set("confirm", "DELETE");

    await expect(softDeleteCragAction(formData)).rejects.toThrow("Unauthorized");
    expect(mockedSoftDeleteContent).not.toHaveBeenCalled();
  });

  it("softDeleteCragAction: auth error fires before confirm guard — malformed confirm does NOT reveal the confirm error message when requireAdmin throws", async () => {
    mockedRequireAdmin.mockRejectedValueOnce(new Error("Unauthorized"));

    const formData = new FormData();
    formData.set("id", "crag_anyang");
    // Deliberately malformed confirm — should never reach the confirm guard
    formData.set("confirm", "not-DELETE");

    let caughtError: Error | undefined;
    try {
      await softDeleteCragAction(formData);
    } catch (e) {
      caughtError = e as Error;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toBe("Unauthorized");
    expect(caughtError!.message).not.toMatch(/"DELETE"/);
    expect(mockedSoftDeleteContent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cache-revalidation context: saveSectorAction reads cragSlug from formData
  // -------------------------------------------------------------------------

  it("saveSectorAction: revalidates crag:<cragSlug> and sector:<sectorSlug> when DB resolves ancestry", async () => {
    // Action resolves cragSlug from DB, not from hidden form field
    mockedGetCragSlugByCragId.mockResolvedValue("anyang");

    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");
    // hidden cragSlug field is now ignored by the action (DB is authoritative)
    formData.set("cragSlug", "anyang");

    await saveSectorAction(formData);

    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("saveSectorAction: skips crag tag when DB returns null for getCragSlugByCragId", async () => {
    // Default mock returns null — crag tag should not fire
    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    expect(mockedRevalidateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^crag:/));
    // sector tag still fires
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
  });

  // -------------------------------------------------------------------------
  // Cache-revalidation context: saveRouteAction reads cragSlug/boulderId/topoId
  // -------------------------------------------------------------------------

  it("saveRouteAction: revalidates route, boulder, crag tags and paths via DB-resolved ancestry", async () => {
    // Action resolves ancestry from DB, not from hidden form fields
    mockedGetTopoAncestry.mockResolvedValue({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder" });

    const formData = new FormData();
    formData.set("id", "route_anaconda");
    formData.set("topoId", "topo_gomul_front");
    formData.set("name", "아나콘다");
    formData.set("slug", "anaconda");
    formData.set("grade", "V5");
    formData.set("gradeNum", "5");
    formData.set("fa", "");
    formData.set("description", "");
    formData.set("lineImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");
    // hidden fields are now ignored; DB ancestry is authoritative
    formData.set("cragSlug", "anyang");
    formData.set("boulderId", "boulder_gomul_boulder");

    await saveRouteAction(formData);

    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:route_anaconda");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_gomul_boulder");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/route_anaconda");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_gomul_front");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  // -------------------------------------------------------------------------
  // saveTopoAction: requireAdmin + upsertTopo + audit
  // -------------------------------------------------------------------------

  it("saveTopoAction: calls requireAdmin, upserts topo, audits content.upsert, revalidates boulder and topo path", async () => {
    // Action resolves cragSlug from DB via getBoulderAncestry
    mockedGetBoulderAncestry.mockResolvedValue({ cragSlug: "anyang", sectorSlug: "anyang_antique" });

    const formData = new FormData();
    formData.set("id", "topo_gomul_front");
    formData.set("boulderId", "boulder_gomul_boulder");
    formData.set("name", "고물 정면");
    formData.set("baseImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");
    // cragSlug hidden field is now ignored; DB ancestry is authoritative
    formData.set("cragSlug", "anyang");

    await saveTopoAction(formData);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedUpsertTopo).toHaveBeenCalledWith(
      expect.objectContaining({ id: "topo_gomul_front", boulderId: "boulder_gomul_boulder" }),
    );
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "content.upsert",
        targetType: "topo",
        targetId: "topo_gomul_front",
      }),
    );
    // Revalidation surface
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_gomul_boulder");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_gomul_front");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("saveTopoAction: generates UUID-based id when no id provided", async () => {
    const formData = new FormData();
    // no id
    formData.set("boulderId", "boulder_gomul_boulder");
    formData.set("name", "고물 정면");
    formData.set("baseImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveTopoAction(formData);

    expect(mockedUpsertTopo).toHaveBeenCalledWith(
      expect.objectContaining({ boulderId: "boulder_gomul_boulder" }),
    );
    // id should start with "topo_" and be longer than just "topo_"
    const calledWith = mockedUpsertTopo.mock.calls[0][0];
    expect(calledWith.id).toMatch(/^topo_.+/);
    expect(calledWith.id).not.toBe("topo_");
  });

  // -------------------------------------------------------------------------
  // restoreAreaAction: restoreContent + audit content.restore
  // -------------------------------------------------------------------------

  it("restoreAreaAction: calls restoreContent, audits content.restore, revalidates home + areas:list", async () => {
    const formData = new FormData();
    formData.set("id", "area_greater_seoul");

    await restoreAreaAction(formData);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedRestoreContent).toHaveBeenCalledWith({ table: "areas", id: "area_greater_seoul" });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "content.restore",
        targetType: "area",
        targetId: "area_greater_seoul",
      }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("areas:list");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });

  // -------------------------------------------------------------------------
  // softDeleteRouteAction: previously untested
  // -------------------------------------------------------------------------

  it("softDeleteRouteAction: calls softDeleteContent, audits, revalidates route+boulder+crag tags and paths via DB ancestry", async () => {
    // Action resolves ancestry from DB, not from hidden form fields
    mockedGetRouteAncestry.mockResolvedValue({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder", topoId: "topo_gomul_front" });

    const formData = new FormData();
    formData.set("id", "route_anaconda");
    // hidden fields are now ignored; DB ancestry is authoritative
    formData.set("cragSlug", "anyang");
    formData.set("boulderId", "boulder_gomul_boulder");
    formData.set("topoId", "topo_gomul_front");
    formData.set("confirm", "DELETE");

    await softDeleteRouteAction(formData);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedSoftDeleteContent).toHaveBeenCalledWith({ table: "routes", id: "route_anaconda" });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "content.soft_delete",
        targetType: "route",
        targetId: "route_anaconda",
      }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:route_anaconda");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_gomul_boulder");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/route_anaconda");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_gomul_front");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("softDeleteRouteAction: still revalidates route tag when DB ancestry returns null", async () => {
    // Default mock returns null for ancestry — boulder/crag tags should not fire
    const formData = new FormData();
    formData.set("id", "route_anaconda");
    formData.set("confirm", "DELETE");

    await softDeleteRouteAction(formData);

    expect(mockedSoftDeleteContent).toHaveBeenCalledWith({ table: "routes", id: "route_anaconda" });
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:route_anaconda");
    // boulder/crag tags must NOT fire when ancestry returns null
    expect(mockedRevalidateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^boulder:/));
    expect(mockedRevalidateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^crag:/));
  });

  // -------------------------------------------------------------------------
  // Task 17 regression tests: authoritative ancestry from D1
  // -------------------------------------------------------------------------

  it("togglePublishAction (routes): revalidates route+boulder+crag surfaces via DB ancestry", async () => {
    mockedGetRouteAncestry.mockResolvedValue({ cragSlug: "anyang", boulderId: "boulder_x", topoId: "topo_y" });

    const formData = new FormData();
    formData.set("table", "routes");
    formData.set("id", "route_z");
    formData.set("isPublished", "off");

    await togglePublishAction(formData);

    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:route_z");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_x");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/route_z");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_y");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("togglePublishAction (topos): revalidates topo+boulder surfaces via DB ancestry", async () => {
    mockedGetTopoAncestry.mockResolvedValue({ cragSlug: "anyang", boulderId: "boulder_x" });

    const formData = new FormData();
    formData.set("table", "topos");
    formData.set("id", "topo_y");
    formData.set("isPublished", "off");

    await togglePublishAction(formData);

    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_x");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_y");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("saveSectorAction (no hidden cragSlug): resolves cragSlug from DB and fires crag tag", async () => {
    mockedGetCragSlugByCragId.mockResolvedValue("anyang");

    const formData = new FormData();
    // No cragSlug hidden field — would have silently degraded before this fix
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    expect(mockedGetCragSlugByCragId).toHaveBeenCalledWith("crag_anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
  });

  it("saveRouteAction (no hidden context): resolves ancestry from DB and fires crag+boulder tags", async () => {
    mockedGetTopoAncestry.mockResolvedValue({ cragSlug: "anyang", boulderId: "boulder_gomul_boulder" });

    const formData = new FormData();
    // No cragSlug / boulderId hidden fields — would have silently degraded before this fix
    formData.set("topoId", "topo_gomul_front");
    formData.set("name", "아나콘다");
    formData.set("slug", "anaconda");
    formData.set("grade", "V5");
    formData.set("gradeNum", "5");
    formData.set("fa", "");
    formData.set("description", "");
    formData.set("lineImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");

    await saveRouteAction(formData);

    expect(mockedGetTopoAncestry).toHaveBeenCalledWith("topo_gomul_front");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_gomul_boulder");
  });

  it("softDeleteSectorAction (no hidden cragSlug): resolves ancestry from DB and fires parent tags", async () => {
    mockedGetSectorAncestry.mockResolvedValue({ cragSlug: "anyang", sectorSlug: "anyang_antique" });

    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    // No cragSlug / slug hidden fields — would have silently degraded before this fix
    formData.set("confirm", "DELETE");

    await softDeleteSectorAction(formData);

    expect(mockedGetSectorAncestry).toHaveBeenCalledWith("sector_anyang_antique");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  // -------------------------------------------------------------------------
  // Task 18 regression tests: invalidate OLD AND NEW ancestry when parent moves
  // -------------------------------------------------------------------------

  it("saveSectorAction (edit, parent move): invalidates old AND new crag tags", async () => {
    // OLD ancestry: sector lives under "anyang" crag
    mockedGetSectorAncestry.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "old_sector" });
    // NEW ancestry: sector being moved to "samsung" crag
    mockedGetCragSlugByCragId.mockResolvedValue("samsung");

    const formData = new FormData();
    formData.set("id", "sector_x");
    formData.set("cragId", "crag_samsung");
    formData.set("name", "새 구역");
    formData.set("slug", "new_sector");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    // OLD ancestry fetched before upsert
    expect(mockedGetSectorAncestry).toHaveBeenCalledWith("sector_x");
    // Both old and new crag surfaces invalidated
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:samsung");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    // Old sector slug tag also fires
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:old_sector");
  });

  it("saveBoulderAction (edit, parent move): invalidates old AND new crag/sector tags", async () => {
    // OLD ancestry: boulder lives under anyang/anyang_antique
    mockedGetBoulderAncestry.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "anyang_antique" });
    // NEW ancestry: boulder being moved to samsung/samsung_east sector
    mockedGetSectorAncestry.mockResolvedValue({ cragSlug: "samsung", sectorSlug: "samsung_east" });

    const formData = new FormData();
    formData.set("id", "boulder_x");
    formData.set("sectorId", "sector_samsung_east");
    formData.set("name", "볼더 X");
    formData.set("slug", "boulder_x_slug");
    formData.set("lat", "37.42");
    formData.set("lng", "126.92");
    formData.set("hashtags", "");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveBoulderAction(formData);

    // OLD ancestry fetched before upsert
    expect(mockedGetBoulderAncestry).toHaveBeenCalledWith("boulder_x");
    // NEW surface
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:samsung");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:samsung_east");
    // OLD surface
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
  });

  it("saveTopoAction (edit, parent move): invalidates old AND new boulder/crag paths", async () => {
    // OLD ancestry: topo lives under boulder_old in anyang
    mockedGetTopoAncestry.mockResolvedValueOnce({ cragSlug: "anyang", boulderId: "boulder_old" });
    // NEW ancestry: topo being moved to boulder_new in samsung
    mockedGetBoulderAncestry.mockResolvedValue({ cragSlug: "samsung", sectorSlug: "samsung_east" });

    const formData = new FormData();
    formData.set("id", "topo_x");
    formData.set("boulderId", "boulder_new");
    formData.set("name", "새 토포");
    formData.set("baseImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveTopoAction(formData);

    // OLD ancestry fetched before upsert
    expect(mockedGetTopoAncestry).toHaveBeenCalledWith("topo_x");
    // NEW surface
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_new");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/samsung");
    // OLD surface
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_old");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
    // topo path fires for both (same topo id)
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_x");
  });

  it("saveRouteAction (edit, parent move): invalidates old AND new topo path and crag/boulder tags", async () => {
    // OLD ancestry: route lives under topo_old / boulder_old_b / anyang
    mockedGetRouteAncestry.mockResolvedValueOnce({ cragSlug: "anyang", boulderId: "boulder_old_b", topoId: "topo_old" });
    // NEW ancestry: route being moved to topo_new / boulder_new_b / samsung
    mockedGetTopoAncestry.mockResolvedValue({ cragSlug: "samsung", boulderId: "boulder_new_b" });

    const formData = new FormData();
    formData.set("id", "route_z");
    formData.set("topoId", "topo_new");
    formData.set("name", "새 루트");
    formData.set("slug", "new_route");
    formData.set("grade", "V5");
    formData.set("gradeNum", "5");
    formData.set("fa", "");
    formData.set("description", "");
    formData.set("lineImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "1");

    await saveRouteAction(formData);

    // OLD ancestry fetched before upsert
    expect(mockedGetRouteAncestry).toHaveBeenCalledWith("route_z");
    // NEW surface
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:samsung");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_new_b");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_new");
    // OLD surface — topo path and crag/boulder tags fire for old parent
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/topo_old");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_old_b");
  });

  it("saveSectorAction (no-op edit, same parent): revalidates surface exactly once, no crash", async () => {
    // OLD and NEW ancestry both resolve to same crag
    mockedGetSectorAncestry.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "anyang_antique" });
    mockedGetCragSlugByCragId.mockResolvedValue("anyang");

    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역 (수정)");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await expect(saveSectorAction(formData)).resolves.toBeUndefined();

    // crag:anyang fires from the NEW-side revalidation
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    // sector:anyang_antique fires from the NEW-side revalidation
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
    // No second revalidation for old side (same parent — OLD == NEW, so no extra call)
    const cragCalls = mockedRevalidateTag.mock.calls.filter((c) => c[0] === "crag:anyang");
    expect(cragCalls).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Task 19: descendant invalidation when parent moves
  // -------------------------------------------------------------------------

  it("saveSectorAction (edit, parent move): invalidates descendant boulder/topo/route detail caches", async () => {
    // OLD ancestry: sector lives under "anyang" crag
    mockedGetSectorAncestry.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "old" });
    // NEW ancestry: sector being moved to "samsung" crag
    mockedGetCragSlugByCragId.mockResolvedValue("samsung");
    // Descendants
    mockedGetSectorDescendantIds.mockResolvedValue({
      boulderIds: ["b1", "b2"],
      topoIds: ["t1"],
      routeIds: ["r1", "r2"],
    });

    const formData = new FormData();
    formData.set("id", "sector_x");
    formData.set("cragId", "crag_samsung");
    formData.set("name", "새 구역");
    formData.set("slug", "new");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    // Descendant boulder tags
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:b1");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:b2");
    // Descendant topo path
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/t1");
    // Descendant route tags and paths
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:r1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/r1");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:r2");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/r2");
    // OLD and NEW crag surfaces still fire (Task 18 behavior)
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:samsung");
  });

  it("saveSectorAction (edit, no parent change): does NOT enumerate descendants", async () => {
    // OLD == NEW ancestry (same crag, same slug)
    mockedGetSectorAncestry.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "slug" });
    mockedGetCragSlugByCragId.mockResolvedValue("anyang");

    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "slug");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveSectorAction(formData);

    // Descendant helper must NOT have been called
    expect(mockedGetSectorDescendantIds).not.toHaveBeenCalled();
  });

  it("saveBoulderAction (edit, parent move): invalidates descendant topo/route detail caches", async () => {
    // OLD ancestry: boulder lives under anyang/anyang_antique sector
    mockedGetBoulderAncestry.mockResolvedValueOnce({ cragSlug: "anyang", sectorSlug: "anyang_antique" });
    // NEW ancestry: boulder being moved to samsung/samsung_east sector
    mockedGetSectorAncestry.mockResolvedValue({ cragSlug: "samsung", sectorSlug: "samsung_east" });
    // Descendants
    mockedGetBoulderDescendantIds.mockResolvedValue({
      topoIds: ["t1"],
      routeIds: ["r1", "r2"],
    });

    const formData = new FormData();
    formData.set("id", "boulder_x");
    formData.set("sectorId", "sector_samsung_east");
    formData.set("name", "볼더 X");
    formData.set("slug", "boulder_x_slug");
    formData.set("lat", "37.42");
    formData.set("lng", "126.92");
    formData.set("hashtags", "");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveBoulderAction(formData);

    // Descendant topo path
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/topos/t1");
    // Descendant route tags and paths
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:r1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/r1");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:r2");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/r2");
    // OLD and NEW surfaces still fire (Task 18 behavior)
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:samsung");
  });

  it("saveTopoAction (edit, parent move): invalidates descendant route detail caches only", async () => {
    // OLD ancestry: topo lives under boulder_old in anyang
    mockedGetTopoAncestry.mockResolvedValueOnce({ cragSlug: "anyang", boulderId: "boulder_old" });
    // NEW ancestry: topo being moved to boulder_new in samsung
    mockedGetBoulderAncestry.mockResolvedValue({ cragSlug: "samsung", sectorSlug: "samsung_east" });
    // Descendants
    mockedGetTopoDescendantIds.mockResolvedValue({ routeIds: ["r1"] });

    const formData = new FormData();
    formData.set("id", "topo_x");
    formData.set("boulderId", "boulder_new");
    formData.set("name", "새 토포");
    formData.set("baseImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");

    await saveTopoAction(formData);

    // Descendant route tag and path
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:r1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/r/r1");
    // OLD and NEW surfaces still fire (Task 18 behavior)
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_old");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("boulder:boulder_new");
    // No boulder tags from descendant logic (topos only have route descendants)
    // Confirm getBoulderDescendantIds was NOT called
    expect(mockedGetBoulderDescendantIds).not.toHaveBeenCalled();
  });
});
