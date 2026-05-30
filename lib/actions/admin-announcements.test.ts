import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks (hoisted before lazy imports)
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db/admin-queries", () => ({
  insertAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/admin-content-queries", () => ({
  upsertAnnouncement: vi.fn(),
  softDeleteContent: vi.fn(),
  restoreContent: vi.fn(),
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
  upsertAnnouncement,
  softDeleteContent,
  restoreContent,
} from "@/lib/db/admin-content-queries";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  saveAnnouncementAction,
  softDeleteAnnouncementAction,
  restoreAnnouncementAction,
} from "./admin-announcements";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedInsertAdminAuditLog = vi.mocked(insertAdminAuditLog);
const mockedUpsertAnnouncement = vi.mocked(upsertAnnouncement);
const mockedSoftDeleteContent = vi.mocked(softDeleteContent);
const mockedRestoreContent = vi.mocked(restoreContent);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRevalidateTag = vi.mocked(revalidateTag);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCreateForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("title", "이번 주 볼더링 이벤트");
  fd.set("body", "자세한 내용은 인스타를 참고하세요.");
  fd.set("coverImageUrl", "");
  fd.set("cragId", "");
  fd.set("linkUrl", "");
  fd.set("isPublished", "on");
  fd.set("publishedAt", "");
  fd.set("sortOrder", "0");
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin announcement actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue({
      adminId: "admin_1",
      email: "ops@granite.kr",
      displayName: "Ops",
    });
    mockedUpsertAnnouncement.mockResolvedValue(undefined);
    mockedSoftDeleteContent.mockResolvedValue(undefined);
    mockedRestoreContent.mockResolvedValue(undefined);
    mockedInsertAdminAuditLog.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // saveAnnouncementAction
  // -------------------------------------------------------------------------

  it("saveAnnouncementAction: calls requireAdmin first, then upserts with a generated UUID-based id, audits 'announcement.upsert', revalidates home + '/'", async () => {
    const formData = makeCreateForm();

    await saveAnnouncementAction(formData);

    // requireAdmin called
    expect(mockedRequireAdmin).toHaveBeenCalled();

    // upsert called with UUID-based id (no slug)
    expect(mockedUpsertAnnouncement).toHaveBeenCalledOnce();
    const [upsertArg] = mockedUpsertAnnouncement.mock.calls[0];
    expect(upsertArg.id).toMatch(/^announcement_[0-9a-f-]{36}$/);
    expect(upsertArg.title).toBe("이번 주 볼더링 이벤트");

    // audit written
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "announcement.upsert",
        targetType: "announcement",
        targetId: upsertArg.id,
        metadata: { title: "이번 주 볼더링 이벤트" },
      }),
    );

    // revalidation
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("saveAnnouncementAction: uses provided id when form includes an id field (edit case)", async () => {
    const formData = makeCreateForm({ id: "announcement_existing-id" });

    await saveAnnouncementAction(formData);

    expect(mockedUpsertAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ id: "announcement_existing-id" }),
    );
  });

  it("saveAnnouncementAction: audit failure does NOT throw — mutation already committed", async () => {
    mockedInsertAdminAuditLog.mockRejectedValueOnce(new Error("DB connection failed"));

    const formData = makeCreateForm();

    // Must resolve without throwing
    await expect(saveAnnouncementAction(formData)).resolves.toBeUndefined();

    // Upsert still ran
    expect(mockedUpsertAnnouncement).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // softDeleteAnnouncementAction
  // -------------------------------------------------------------------------

  it("softDeleteAnnouncementAction: throws when confirm field is not 'DELETE'", async () => {
    const fd = new FormData();
    fd.set("id", "announcement_abc");
    fd.set("confirm", "delete"); // wrong case

    await expect(softDeleteAnnouncementAction(fd)).rejects.toThrow(/"DELETE"/);
    expect(mockedSoftDeleteContent).not.toHaveBeenCalled();
  });

  it("softDeleteAnnouncementAction: calls requireAdmin, softDeleteContent with table='announcements', audits 'announcement.soft_delete', revalidates home + '/'", async () => {
    const fd = new FormData();
    fd.set("id", "announcement_abc");
    fd.set("confirm", "DELETE");

    await softDeleteAnnouncementAction(fd);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedSoftDeleteContent).toHaveBeenCalledWith({
      table: "announcements",
      id: "announcement_abc",
    });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "announcement.soft_delete",
        targetType: "announcement",
        targetId: "announcement_abc",
      }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("softDeleteAnnouncementAction: mutation is NOT called when requireAdmin throws", async () => {
    mockedRequireAdmin.mockRejectedValueOnce(new Error("Unauthorized"));

    const fd = new FormData();
    fd.set("id", "announcement_abc");
    fd.set("confirm", "DELETE");

    await expect(softDeleteAnnouncementAction(fd)).rejects.toThrow("Unauthorized");
    expect(mockedSoftDeleteContent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // restoreAnnouncementAction
  // -------------------------------------------------------------------------

  it("restoreAnnouncementAction: calls requireAdmin, restoreContent with table='announcements', audits 'announcement.restore', revalidates home + '/'", async () => {
    const fd = new FormData();
    fd.set("id", "announcement_abc");

    await restoreAnnouncementAction(fd);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(mockedRestoreContent).toHaveBeenCalledWith({
      table: "announcements",
      id: "announcement_abc",
    });
    expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "announcement.restore",
        targetType: "announcement",
        targetId: "announcement_abc",
      }),
    );
    expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
  });
});
