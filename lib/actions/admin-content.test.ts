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
      expect.objectContaining({ id: "sector_anyang_antique" }),
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
      expect.objectContaining({ id: "boulder_gomul_boulder" }),
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
      expect.objectContaining({ id: "route_anaconda" }),
    );
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
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
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

  // -------------------------------------------------------------------------
  // Cache-revalidation context: saveSectorAction reads cragSlug from formData
  // -------------------------------------------------------------------------

  it("saveSectorAction: revalidates crag:<cragSlug> and sector:<sectorSlug> when cragSlug in formData", async () => {
    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");
    // Revalidation context hint (hidden field supplied by admin form)
    formData.set("cragSlug", "anyang");

    await saveSectorAction(formData);

    expect(mockedRevalidateTag).toHaveBeenCalledWith("crag:anyang");
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/c/anyang");
  });

  it("saveSectorAction: skips crag tag when cragSlug not in formData", async () => {
    const formData = new FormData();
    formData.set("id", "sector_anyang_antique");
    formData.set("cragId", "crag_anyang");
    formData.set("name", "앤틱 구역");
    formData.set("slug", "anyang_antique");
    formData.set("coverImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");
    // No cragSlug field

    await saveSectorAction(formData);

    expect(mockedRevalidateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^crag:/));
    // sector tag still fires
    expect(mockedRevalidateTag).toHaveBeenCalledWith("sector:anyang_antique");
  });

  // -------------------------------------------------------------------------
  // Cache-revalidation context: saveRouteAction reads cragSlug/boulderId/topoId
  // -------------------------------------------------------------------------

  it("saveRouteAction: revalidates route, boulder, crag tags and paths when context in formData", async () => {
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
    // Revalidation context hints (hidden fields supplied by admin form)
    formData.set("cragSlug", "anyang");
    formData.set("boulderId", "boulder_gomul_boulder");
    // topoId is already in parsed schema (topo_gomul_front)

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
    const formData = new FormData();
    formData.set("id", "topo_gomul_front");
    formData.set("boulderId", "boulder_gomul_boulder");
    formData.set("name", "고물 정면");
    formData.set("baseImageUrl", "");
    formData.set("isPublished", "on");
    formData.set("sortOrder", "0");
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

  it("softDeleteRouteAction: calls softDeleteContent, audits, revalidates route+boulder+crag tags and paths", async () => {
    const formData = new FormData();
    formData.set("id", "route_anaconda");
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

  it("softDeleteRouteAction: still revalidates route tag when context fields absent", async () => {
    const formData = new FormData();
    formData.set("id", "route_anaconda");
    formData.set("confirm", "DELETE");
    // No cragSlug / boulderId / topoId

    await softDeleteRouteAction(formData);

    expect(mockedSoftDeleteContent).toHaveBeenCalledWith({ table: "routes", id: "route_anaconda" });
    expect(mockedRevalidateTag).toHaveBeenCalledWith("route:route_anaconda");
    // boulder/crag tags must NOT fire when missing
    expect(mockedRevalidateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^boulder:/));
    expect(mockedRevalidateTag).not.toHaveBeenCalledWith(expect.stringMatching(/^crag:/));
  });
});
