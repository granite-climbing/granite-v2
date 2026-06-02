import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./d1-http", () => ({
  queryD1: vi.fn(),
  queryD1First: vi.fn(),
  executeD1Meta: vi.fn(),
}));

const { queryD1, queryD1First, executeD1Meta } = await import("./d1-http");
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
    vi.mocked(executeD1Meta).mockReset();
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
      externalId: "ig_comment_1",
      externalMediaId: "ig_media_1",
      igUserId: "ig_user_1",
      igUsername: "climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://www.instagram.com/p/abc/",
      thumbnailUrl: null,
      rawPayload: "{}",
    });

    expect(queryD1).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO webhook_inbox"),
      expect.any(Array)
    );
    expect(queryD1).toHaveBeenCalledWith(
      expect.stringContaining("external_media_id"),
      expect.any(Array)
    );
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

describe("manualMatchWebhookToRoute", () => {
  beforeEach(() => {
    vi.mocked(queryD1).mockReset();
    vi.mocked(queryD1First).mockReset();
    vi.mocked(executeD1Meta).mockReset();
  });

  it("claims an unmatched row, dedup-checks, and inserts a beta with the canonical media id", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: "media_1",
        },
      ]) // SELECT row
      .mockResolvedValueOnce([]) // INSERT betas
      .mockResolvedValueOnce([]); // UPDATE finalize
    vi.mocked(queryD1First).mockResolvedValueOnce(null); // findExistingBetaByExternalMedia

    const { manualMatchWebhookToRoute } = await import("./beta-queries");

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({ ok: true, betaId: "beta_new" });
    const insertCall = vi
      .mocked(queryD1)
      .mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
      );
    // The 6th positional parameter is external_media_id (canonical media id).
    expect(insertCall?.[1]).toContain("media_1");
    // And NOT the comment_id.
    expect(insertCall?.[1]).not.toContain("comment_1");
  });

  it("returns not_unmatched when the row is no longer claimable", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 0 });

    const { manualMatchWebhookToRoute } = await import("./beta-queries");

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({ ok: false, reason: "not_unmatched" });
    expect(queryD1).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO betas"),
      expect.anything()
    );
  });

  it("returns duplicate without inserting a new beta when canonical media exists", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: "media_1",
        },
      ]) // SELECT row
      .mockResolvedValueOnce([]); // UPDATE webhook to duplicate
    vi.mocked(queryD1First).mockResolvedValueOnce({
      id: "beta_existing",
      status: "pending",
    }); // findExistingBetaByExternalMedia returns existing

    const { manualMatchWebhookToRoute } = await import("./beta-queries");

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "duplicate",
      existingBetaId: "beta_existing",
    });
    const insertCalls = vi
      .mocked(queryD1)
      .mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
      );
    expect(insertCalls.length).toBe(0);
  });
});
