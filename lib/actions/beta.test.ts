import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", () => ({ randomUUID: () => "uuid-1" }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/db/beta-queries", () => ({
  createManualBeta: vi.fn(),
  findExistingBetaByPermalink: vi.fn(),
  updateBetaThumbnailUrl: vi.fn(),
}));
vi.mock("@/lib/beta/thumbnail-r2", () => ({
  acquireAndStoreBetaThumbnail: vi.fn().mockResolvedValue(null),
}));

const { createManualBeta, findExistingBetaByPermalink } = await import("@/lib/db/beta-queries");
const { submitManualBetaAction } = await import("./beta");

describe("submitManualBetaAction", () => {
  beforeEach(() => {
    vi.mocked(createManualBeta).mockReset();
    vi.mocked(findExistingBetaByPermalink).mockReset();
    vi.mocked(findExistingBetaByPermalink).mockResolvedValue(null);
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
      externalMediaId: null,
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
    vi.mocked(findExistingBetaByPermalink).mockResolvedValue({ id: "beta_existing", status: "pending" });
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
});
