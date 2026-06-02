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
          rawPayload: "{}",
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
          rawPayload: "{}",
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

  it("reverts to unmatched and logs operational state when beta insert fails", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });

    const insertError = new Error("D1 UNIQUE constraint");
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: "media_1",
          rawPayload: "{}",
        },
      ]) // SELECT row
      .mockRejectedValueOnce(insertError) // INSERT betas FAILS
      .mockResolvedValueOnce([]); // compensating revert UPDATE
    vi.mocked(queryD1First).mockResolvedValueOnce(null); // findExistingBetaByExternalMedia

    const { manualMatchWebhookToRoute } = await import("./beta-queries");

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({ ok: false, reason: "not_unmatched" });

    // Compensating revert ran: status back to unmatched with manual_match_insert_failed error code.
    const revertCall = vi
      .mocked(queryD1)
      .mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("UPDATE webhook_inbox") &&
          c[0].includes("status = 'unmatched'") &&
          c[0].includes("manual_match_insert_failed")
      );
    expect(revertCall).toBeDefined();
  });

  it("logs orphan operational event when finalize update fails and rethrows", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });

    const finalizeError = new Error("D1 network blip");
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: "media_1",
          rawPayload: "{}",
        },
      ]) // SELECT row
      .mockResolvedValueOnce([]) // INSERT betas (success)
      .mockRejectedValueOnce(finalizeError) // finalize UPDATE FAILS
      .mockResolvedValueOnce([]); // insertWebhookOperationalEvent (best-effort)
    vi.mocked(queryD1First).mockResolvedValueOnce(null); // findExistingBetaByExternalMedia

    const { manualMatchWebhookToRoute } = await import("./beta-queries");

    await expect(
      manualMatchWebhookToRoute({
        webhookId: "webhook_1",
        routeId: "route_1",
        betaId: "beta_new",
      })
    ).rejects.toThrow(finalizeError);

    // Beta was inserted before the failure
    const insertBetaCall = vi
      .mocked(queryD1)
      .mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
      );
    expect(insertBetaCall).toBeDefined();

    // Operational event inserted with orphan kind metadata
    const opEventCall = vi
      .mocked(queryD1)
      .mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("INSERT INTO webhook_operational_events")
      );
    expect(opEventCall).toBeDefined();
  });

  it("uses media_id parsed from raw_payload when external_media_id is null (legacy comment mention)", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
    const legacyRawPayload = JSON.stringify({
      entry: [
        {
          id: "ig_user_1",
          changes: [
            {
              field: "mentions",
              value: { media_id: "media_from_payload", comment_id: "comment_1" },
            },
          ],
        },
      ],
    });
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: null,
          rawPayload: legacyRawPayload,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(queryD1First).mockResolvedValueOnce(null);

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
    expect(insertCall?.[1]).toContain("media_from_payload");
    expect(insertCall?.[1]).not.toContain("comment_1");
  });

  it("refuses manual match and surfaces needs_rehydration when raw_payload has no media_id", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "",
          mediaUrl: "",
          externalId: "comment_only",
          externalMediaId: null,
          rawPayload: "{}",
        },
      ])
      .mockResolvedValueOnce([]); // revert UPDATE

    const { manualMatchWebhookToRoute } = await import("./beta-queries");

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({ ok: false, reason: "needs_rehydration" });

    const revertCall = vi
      .mocked(queryD1)
      .mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("UPDATE webhook_inbox") &&
          c[0].includes("status = 'unmatched'") &&
          c[0].includes("needs_rehydration")
      );
    expect(revertCall).toBeDefined();
  });
});
