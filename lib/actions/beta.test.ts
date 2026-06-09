import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", () => ({ randomUUID: () => "uuid-1" }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/db/beta-queries", () => ({
  createManualBeta: vi.fn(),
  findExistingBetaByExternalMedia: vi.fn(),
  findExistingBetaByPermalink: vi.fn(),
  findPublishedRouteIdForBeta: vi.fn(),
  updateBetaThumbnailUrl: vi.fn(),
}));
vi.mock("@/lib/beta/thumbnail-r2", () => ({
  acquireAndStoreBetaThumbnail: vi.fn().mockResolvedValue(null),
}));

const { createManualBeta, findExistingBetaByExternalMedia, findExistingBetaByPermalink, findPublishedRouteIdForBeta } = await import("@/lib/db/beta-queries");
const { submitManualBetaAction } = await import("./beta");

describe("submitManualBetaAction", () => {
  beforeEach(() => {
    vi.mocked(createManualBeta).mockReset();
    vi.mocked(findExistingBetaByExternalMedia).mockReset();
    vi.mocked(findExistingBetaByExternalMedia).mockResolvedValue(null);
    vi.mocked(findExistingBetaByPermalink).mockReset();
    vi.mocked(findExistingBetaByPermalink).mockResolvedValue(null);
    vi.mocked(findPublishedRouteIdForBeta).mockReset();
    vi.mocked(findPublishedRouteIdForBeta).mockResolvedValue({ id: "route_1" });
  });

  it("creates a pending manual instagram beta", async () => {
    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://www.instagram.com/p/abc/");
    form.set("displayName", "Climber");
    form.set("instagramId", "@climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).resolves.toEqual({
      ok: true,
      message: "베타 영상이 등록되었습니다.",
    });

    expect(createManualBeta).toHaveBeenCalledWith({
      id: "beta_uuid-1",
      routeId: "route_1",
      instagramId: "climber",
      displayName: "Climber",
      platform: "instagram",
      mediaUrl: "https://www.instagram.com/p/abc/",
      permalinkUrl: "https://www.instagram.com/p/abc/",
      externalMediaId: "abc",
      sentAt: "2026-06-02",
    });
  });

  it("rejects unsupported URLs", async () => {
    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://example.com/video");
    form.set("displayName", "Climber");
    form.set("instagramId", "climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).rejects.toThrow("Unsupported media URL");
  });

  it("returns duplicate message without creating a new beta", async () => {
    vi.mocked(findExistingBetaByExternalMedia).mockResolvedValue({ id: "beta_existing", status: "pending" });
    // findExistingBetaByPermalink mock can stay at its default (returns null); not reached.
    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://www.instagram.com/p/abc/");
    form.set("displayName", "Climber");
    form.set("instagramId", "@climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).resolves.toEqual({
      ok: false,
      message: "이미 등록된 영상입니다.",
    });
    expect(createManualBeta).not.toHaveBeenCalled();
  });

  it("rejects a second submission that resolves to the same canonical media id", async () => {
    vi.mocked(findExistingBetaByExternalMedia).mockResolvedValueOnce({ id: "beta_existing", status: "pending" });
    vi.mocked(findExistingBetaByPermalink).mockResolvedValue(null);

    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share");
    form.set("displayName", "Climber");
    form.set("instagramId", "@climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).resolves.toEqual({
      ok: false,
      message: "이미 등록된 영상입니다.",
    });

    expect(findExistingBetaByExternalMedia).toHaveBeenCalledWith("youtube", "dQw4w9WgXcQ");
  });

  it("rejects submission when the route is not published or has been deleted", async () => {
    vi.mocked(findPublishedRouteIdForBeta).mockResolvedValueOnce(null);

    const form = new FormData();
    form.set("routeId", "route_draft");
    form.set("mediaUrl", "https://www.instagram.com/p/abc/");
    form.set("displayName", "Climber");
    form.set("instagramId", "@climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).resolves.toEqual({
      ok: false,
      message: "유효하지 않은 루트입니다.",
    });

    expect(createManualBeta).not.toHaveBeenCalled();
  });
});
