import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./d1-http", () => ({
  queryD1: vi.fn(),
  queryD1First: vi.fn(),
}));

const { queryD1, queryD1First } = await import("./d1-http");
const {
  createManualBeta,
  findPublishedRouteMatchCandidates,
  getAdminBetas,
  insertWebhookInbox,
  markWebhookRejected,
} = await import("./beta-queries");

describe("beta queries", () => {
  beforeEach(() => {
    vi.mocked(queryD1).mockReset();
    vi.mocked(queryD1First).mockReset();
  });

  it("creates manual unclaimed beta rows", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await createManualBeta({
      id: "beta_1",
      routeId: "route_1",
      instagramId: "climber",
      displayName: "Climber",
      platform: "instagram",
      mediaUrl: "https://www.instagram.com/p/abc/",
      permalinkUrl: "https://www.instagram.com/p/abc/",
      externalMediaId: null,
      sentAt: "2026-06-02",
    });

    expect(queryD1).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO betas"),
      expect.arrayContaining(["beta_1", "route_1", "climber", "Climber", "instagram"])
    );
  });

  it("maps admin beta rows", async () => {
    vi.mocked(queryD1).mockResolvedValue([
      {
        id: "beta_1",
        routeId: "route_1",
        routeName: "Sky Hook",
        boulderName: "큰바위",
        cragName: "모락산",
        userId: null,
        instagramId: "climber",
        displayName: "Climber",
        source: "manual",
        platform: "instagram",
        mediaUrl: "https://www.instagram.com/p/abc/",
        permalinkUrl: "https://www.instagram.com/p/abc/",
        externalMediaId: null,
        thumbnailUrl: null,
        sentAt: "2026-06-02",
        status: "pending",
        claimStatus: "unclaimed",
        createdAt: "2026-06-02 00:00:00",
        updatedAt: "2026-06-02 00:00:00",
        deletedAt: null,
      },
    ]);

    await expect(getAdminBetas({ status: "pending" })).resolves.toHaveLength(1);
  });

  it("inserts webhook inbox idempotency rows", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await insertWebhookInbox({
      id: "webhook_1",
      externalId: "ig_media_1",
      igUserId: "ig_user_1",
      igUsername: "climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://www.instagram.com/p/abc/",
      thumbnailUrl: null,
      rawPayload: "{}",
    });

    expect(queryD1).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE INTO webhook_inbox"), expect.any(Array));
  });

  it("queries published route candidates for matching", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await findPublishedRouteMatchCandidates();
    expect(queryD1).toHaveBeenCalledWith(expect.stringContaining("FROM routes r"), []);
  });

  it("marks webhook entries rejected", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await markWebhookRejected("webhook_1");
    expect(queryD1).toHaveBeenCalledWith(expect.stringContaining("status = 'rejected'"), ["webhook_1"]);
  });
});
