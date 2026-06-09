import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./d1", () => ({
  insertWebhookInbox: vi.fn(),
  setWebhookInboxStatus: vi.fn(),
  insertWebhookOperationalEvent: vi.fn(),
  findExistingBetaByExternalMedia: vi.fn(),
  findPublishedRouteCandidates: vi.fn(),
  insertWebhookBeta: vi.fn(),
  hydrateWebhookInbox: vi.fn(),
  tryReclaimWebhookForRetry: vi.fn(),
}));
vi.mock("./graph-api", () => ({
  fetchMentionedMedia: vi.fn(),
  fetchMentionedComment: vi.fn(),
}));
vi.mock("./thumbnail", () => ({
  attemptThumbnailCopy: vi.fn().mockResolvedValue(null),
}));

const d1 = await import("./d1");
const graph = await import("./graph-api");
const { processMentionEvent } = await import("./match");

const env = {
  META_APP_SECRET: "x",
  META_WEBHOOK_VERIFY_TOKEN: "x",
  INSTAGRAM_GRAPH_ACCESS_TOKEN: "x",
  granite_v2: {} as unknown as D1Database,
  BUCKET: {} as unknown as R2Bucket,
  CDN_BASE_URL: "https://cdn.granite.kr",
};

describe("processMentionEvent error boundary", () => {
  beforeEach(() => {
    vi.mocked(d1.insertWebhookInbox).mockReset().mockResolvedValue({ inserted: true });
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue({ changes: 1 });
    vi.mocked(d1.insertWebhookOperationalEvent).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.tryReclaimWebhookForRetry).mockReset();
    vi.mocked(d1.hydrateWebhookInbox).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.findPublishedRouteCandidates).mockReset();
    vi.mocked(graph.fetchMentionedMedia).mockReset();
    vi.mocked(graph.fetchMentionedComment).mockReset();
  });

  it("marks the row failed and records an operational event when Graph API throws", async () => {
    vi.mocked(graph.fetchMentionedMedia).mockRejectedValue(new Error("timeout"));

    await processMentionEvent(
      { externalId: "m1", igUserId: "u1", mediaId: "m1", commentId: null },
      env,
      "{}"
    );

    const statusCalls = vi.mocked(d1.setWebhookInboxStatus).mock.calls;
    const finalCall = statusCalls[statusCalls.length - 1][1];
    expect(finalCall.status).toBe("failed");
    expect(finalCall.lastErrorCode).toBe("graph_api_exception");

    const opEvents = vi.mocked(d1.insertWebhookOperationalEvent).mock.calls;
    expect(opEvents.some((c) => c[1].eventType === "graph_api_failure")).toBe(true);
  });

  it("does not rethrow when the recovery path itself fails", async () => {
    vi.mocked(graph.fetchMentionedMedia).mockRejectedValue(new Error("timeout"));
    vi.mocked(d1.setWebhookInboxStatus)
      .mockImplementationOnce(async () => ({ changes: 1 })) // processing transition succeeds
      .mockImplementationOnce(async () => {
        throw new Error("d1 down");
      }); // failed transition itself throws

    await expect(
      processMentionEvent(
        { externalId: "m2", igUserId: "u1", mediaId: "m2", commentId: null },
        env,
        "{}"
      )
    ).resolves.toBeUndefined();
  });

  it("hydrates webhook_inbox with resolved Graph API fields before transitioning status", async () => {
    vi.mocked(graph.fetchMentionedMedia).mockResolvedValue({
      username: "@Climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://video.cdninstagram.com/abc",
      thumbnailUrl: "https://scontent.cdninstagram.com/abc.jpg",
      permalink: "https://www.instagram.com/p/abc/",
    });
    vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValue([]); // force unmatched

    await processMentionEvent(
      { externalId: "m3", igUserId: "u1", mediaId: "m3", commentId: null },
      env,
      "{}"
    );

    expect(d1.hydrateWebhookInbox).toHaveBeenCalledWith(
      env.granite_v2,
      expect.objectContaining({
        id: expect.any(String),
        igUsername: "climber",
        caption: "@granite.kr #큰바위 #SkyHook",
        mediaUrl: "https://video.cdninstagram.com/abc",
        permalinkUrl: "https://www.instagram.com/p/abc/",
      })
    );

    const hydrateOrder = vi.mocked(d1.hydrateWebhookInbox).mock.invocationCallOrder[0];
    const statusOrders = vi.mocked(d1.setWebhookInboxStatus).mock.invocationCallOrder;
    const lastStatusOrder = statusOrders[statusOrders.length - 1];
    expect(hydrateOrder).toBeLessThan(lastStatusOrder);
  });
});

describe("processMentionEvent redelivery", () => {
  beforeEach(() => {
    vi.mocked(d1.insertWebhookInbox).mockReset().mockResolvedValue({ inserted: true });
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue({ changes: 1 });
    vi.mocked(d1.insertWebhookOperationalEvent).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.tryReclaimWebhookForRetry).mockReset();
    vi.mocked(d1.hydrateWebhookInbox).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.findPublishedRouteCandidates).mockReset();
    vi.mocked(graph.fetchMentionedMedia).mockReset();
    vi.mocked(graph.fetchMentionedComment).mockReset();
  });

  it("no-ops when Meta redelivers a terminal-state row", async () => {
    vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: false });
    vi.mocked(d1.tryReclaimWebhookForRetry).mockResolvedValueOnce(null);

    await processMentionEvent(
      { externalId: "m_terminal", igUserId: "u1", mediaId: "m_terminal", commentId: null },
      env,
      "{}"
    );

    expect(graph.fetchMentionedMedia).not.toHaveBeenCalled();
    expect(d1.setWebhookInboxStatus).not.toHaveBeenCalled();
  });

  it("reprocesses a failed row when Meta redelivers", async () => {
    vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: false });
    vi.mocked(d1.tryReclaimWebhookForRetry).mockResolvedValueOnce({
      webhookId: "webhook_existing",
      currentStatus: "failed",
      attempts: 2,
    });
    vi.mocked(graph.fetchMentionedMedia).mockResolvedValueOnce({
      username: "@Climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://video.cdninstagram.com/abc",
      thumbnailUrl: "https://scontent.cdninstagram.com/abc.jpg",
      permalink: "https://www.instagram.com/p/abc/",
    });
    vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValueOnce([]);

    await processMentionEvent(
      { externalId: "m_failed", igUserId: "u1", mediaId: "m_failed", commentId: null },
      env,
      "{}"
    );

    expect(d1.hydrateWebhookInbox).toHaveBeenCalledWith(
      env.granite_v2,
      expect.objectContaining({ id: "webhook_existing" })
    );
  });

  it("uses the new row id when insert succeeds (first delivery)", async () => {
    vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: true });
    vi.mocked(graph.fetchMentionedMedia).mockResolvedValueOnce({
      username: "@Climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://video.cdninstagram.com/abc",
      thumbnailUrl: null,
      permalink: null,
    });
    vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValueOnce([]);

    await processMentionEvent(
      { externalId: "m_new", igUserId: "u1", mediaId: "m_new", commentId: null },
      env,
      "{}"
    );

    expect(d1.tryReclaimWebhookForRetry).not.toHaveBeenCalled();
  });
});

describe("processMentionEvent orphan recovery", () => {
  beforeEach(() => {
    vi.mocked(d1.insertWebhookInbox).mockReset().mockResolvedValue({ inserted: true });
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue({ changes: 1 });
    vi.mocked(d1.insertWebhookOperationalEvent).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.tryReclaimWebhookForRetry).mockReset();
    vi.mocked(d1.hydrateWebhookInbox).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.findExistingBetaByExternalMedia).mockReset().mockResolvedValue(null);
    vi.mocked(d1.findPublishedRouteCandidates).mockReset();
    vi.mocked(d1.insertWebhookBeta).mockReset();
    vi.mocked(graph.fetchMentionedMedia).mockReset();
    vi.mocked(graph.fetchMentionedComment).mockReset();
  });

  it("records the betaId in the operational event when the final setWebhookInboxStatus throws", async () => {
    vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: true });
    vi.mocked(graph.fetchMentionedMedia).mockResolvedValueOnce({
      username: "@Climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://video.cdninstagram.com/abc",
      thumbnailUrl: "https://scontent.cdninstagram.com/abc.jpg",
      permalink: "https://www.instagram.com/p/abc/",
    });
    vi.mocked(d1.findExistingBetaByExternalMedia).mockResolvedValueOnce(null);
    vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValueOnce([
      { routeId: "route_1", routeName: "SkyHook", boulderName: "큰바위", boulderHashtags: "[]" },
    ]);
    vi.mocked(d1.insertWebhookBeta).mockResolvedValueOnce(undefined);

    vi.mocked(d1.setWebhookInboxStatus)
      .mockResolvedValueOnce({ changes: 1 }) // initial processing transition
      .mockImplementationOnce(async () => {
        throw new Error("D1 network blip during matched finalize");
      });

    await processMentionEvent(
      { externalId: "m_orphan", igUserId: "u1", mediaId: "m_orphan", commentId: null },
      env,
      "{}"
    );

    const opCalls = vi.mocked(d1.insertWebhookOperationalEvent).mock.calls;
    const orphanCall = opCalls.find((c) => {
      const meta = c[1].metadata;
      return typeof meta === "string" && meta.includes("orphan_beta_auto_match");
    });
    expect(orphanCall).toBeDefined();
    expect(orphanCall?.[1].betaId).toMatch(/^beta_/);
  });
});

describe("processMentionEvent lease guard", () => {
  beforeEach(() => {
    vi.mocked(d1.insertWebhookInbox).mockReset().mockResolvedValue({ inserted: true });
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue({ changes: 1 });
    vi.mocked(d1.insertWebhookOperationalEvent).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.tryReclaimWebhookForRetry).mockReset();
    vi.mocked(d1.hydrateWebhookInbox).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.findExistingBetaByExternalMedia).mockReset().mockResolvedValue(null);
    vi.mocked(d1.findPublishedRouteCandidates).mockReset();
    vi.mocked(d1.insertWebhookBeta).mockReset();
    vi.mocked(graph.fetchMentionedMedia).mockReset();
    vi.mocked(graph.fetchMentionedComment).mockReset();
  });

  it("no-ops on redelivery when processing row is fresh (lease not stale)", async () => {
    vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: false });
    vi.mocked(d1.tryReclaimWebhookForRetry).mockResolvedValueOnce(null);

    await processMentionEvent(
      { externalId: "m_fresh", igUserId: "u1", mediaId: "m_fresh", commentId: null },
      env,
      "{}"
    );

    expect(graph.fetchMentionedMedia).not.toHaveBeenCalled();
  });

  it("stops processing when the lease is lost (setWebhookInboxStatus returns 0 changes)", async () => {
    vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: false });
    vi.mocked(d1.tryReclaimWebhookForRetry).mockResolvedValueOnce({
      webhookId: "webhook_existing",
      currentStatus: "failed",
      attempts: 3,
    });
    vi.mocked(graph.fetchMentionedMedia).mockResolvedValueOnce({
      username: "@Climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://video.cdninstagram.com/abc",
      thumbnailUrl: null,
      permalink: "https://www.instagram.com/p/abc/",
    });
    vi.mocked(d1.findExistingBetaByExternalMedia).mockResolvedValueOnce(null);
    vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValueOnce([
      { routeId: "route_1", routeName: "SkyHook", boulderName: "큰바위", boulderHashtags: "[]" },
    ]);
    vi.mocked(d1.insertWebhookBeta).mockResolvedValueOnce(undefined);

    // All subsequent setWebhookInboxStatus calls return 0 changes — lease lost.
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue({ changes: 0 });

    await expect(
      processMentionEvent(
        { externalId: "m_lost", igUserId: "u1", mediaId: "m_lost", commentId: null },
        env,
        "{}"
      )
    ).resolves.toBeUndefined();
  });
});
