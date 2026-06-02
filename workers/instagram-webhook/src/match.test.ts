import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./d1", () => ({
  insertWebhookInbox: vi.fn(),
  setWebhookInboxStatus: vi.fn(),
  insertWebhookOperationalEvent: vi.fn(),
  findExistingBetaByExternalMedia: vi.fn(),
  findPublishedRouteCandidates: vi.fn(),
  insertWebhookBeta: vi.fn(),
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
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.insertWebhookOperationalEvent).mockReset().mockResolvedValue(undefined);
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
      .mockImplementationOnce(async () => undefined) // processing transition succeeds
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
});
