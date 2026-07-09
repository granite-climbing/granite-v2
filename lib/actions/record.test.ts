import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const verifySessionMock = vi.hoisted(() => vi.fn());
const findActiveUserMock = vi.hoisted(() => vi.fn());
const findPublishedRouteMock = vi.hoisted(() => vi.fn());
const findByExternalMediaMock = vi.hoisted(() => vi.fn());
const findByPermalinkMock = vi.hoisted(() => vi.fn());
const createManualBetaMock = vi.hoisted(() => vi.fn());
const updateThumbnailMock = vi.hoisted(() => vi.fn());
const acquireThumbnailMock = vi.hoisted(() => vi.fn());
const insertUserRecordMock = vi.hoisted(() => vi.fn());
const searchRoutesMock = vi.hoisted(() => vi.fn());
const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/auth/session", () => ({
  USER_SESSION_COOKIE_NAME: "granite_session",
  verifyUserSessionToken: verifySessionMock
}));
vi.mock("@/lib/db/user-auth-queries", () => ({ findActiveUserById: findActiveUserMock }));
vi.mock("@/lib/db/beta-queries", () => ({
  createManualBeta: createManualBetaMock,
  findExistingBetaByExternalMedia: findByExternalMediaMock,
  findExistingBetaByPermalink: findByPermalinkMock,
  findPublishedRouteIdForBeta: findPublishedRouteMock,
  updateBetaThumbnailUrl: updateThumbnailMock
}));
vi.mock("@/lib/beta/thumbnail-r2", () => ({ acquireAndStoreBetaThumbnail: acquireThumbnailMock }));
vi.mock("@/lib/db/record-queries", () => ({
  insertUserRecord: insertUserRecordMock,
  searchPublishedRoutesForRecord: searchRoutesMock
}));

import { addRecordAction, searchRoutesForRecordAction } from "./record";

function loggedInUser() {
  cookiesMock.mockResolvedValue({ get: () => ({ value: "token" }) });
  verifySessionMock.mockResolvedValue({ userId: "user_1" });
  findActiveUserMock.mockResolvedValue({
    id: "user_1",
    displayName: "그래나이트",
    instagramId: "@Granite_User"
  });
}

function formDataOf(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("addRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquireThumbnailMock.mockResolvedValue(null);
  });

  it("rejects when not logged in", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const result = await addRecordAction(formDataOf({ routeId: "route_1", sentAt: "2026-07-09" }));

    expect(result.ok).toBe(false);
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    loggedInUser();

    const result = await addRecordAction(formDataOf({ routeId: "route_1", sentAt: "invalid" }));

    expect(result.ok).toBe(false);
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });

  it("rejects an unpublished route", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue(null);

    const result = await addRecordAction(formDataOf({ routeId: "route_x", sentAt: "2026-07-09" }));

    expect(result).toEqual({ ok: false, message: "유효하지 않은 루트입니다." });
  });

  it("creates a record without media", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });

    const result = await addRecordAction(
      formDataOf({ routeId: "route_1", sentAt: "2026-07-09", rating: "4", mediaUrl: "" })
    );

    expect(result.ok).toBe(true);
    expect(createManualBetaMock).not.toHaveBeenCalled();
    expect(insertUserRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", routeId: "route_1", betaId: null, rating: 4 })
    );
  });

  it("rejects unsupported media links", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });

    const result = await addRecordAction(
      formDataOf({ routeId: "route_1", sentAt: "2026-07-09", mediaUrl: "https://vimeo.com/123" })
    );

    expect(result).toEqual({ ok: false, message: "Instagram 또는 YouTube 링크만 등록할 수 있습니다." });
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });

  it("rejects duplicate media URLs", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue({ id: "beta_existing", status: "approved" });

    const result = await addRecordAction(
      formDataOf({
        routeId: "route_1",
        sentAt: "2026-07-09",
        mediaUrl: "https://youtu.be/abc123"
      })
    );

    expect(result).toEqual({ ok: false, message: "이미 등록된 영상입니다." });
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });

  it("creates a pending user-owned beta and links it to the record", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue(null);
    findByPermalinkMock.mockResolvedValue(null);

    const result = await addRecordAction(
      formDataOf({
        routeId: "route_1",
        sentAt: "2026-07-09",
        rating: "5",
        mediaUrl: "https://youtu.be/abc123"
      })
    );

    expect(result.ok).toBe(true);
    expect(createManualBetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        claimStatus: "claimed",
        platform: "youtube",
        instagramId: "granite_user",
        displayName: "그래나이트",
        sentAt: "2026-07-09"
      })
    );
    const betaId = createManualBetaMock.mock.calls[0][0].id;
    expect(insertUserRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ betaId, rating: 5 })
    );
  });

  it("defers thumbnail acquisition until after the response", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue(null);
    findByPermalinkMock.mockResolvedValue(null);
    acquireThumbnailMock.mockResolvedValue("https://cdn.granite.kr/beta/x/thumb.jpg");

    const result = await addRecordAction(
      formDataOf({ routeId: "route_1", sentAt: "2026-07-09", mediaUrl: "https://youtu.be/abc123" })
    );

    expect(result.ok).toBe(true);
    expect(acquireThumbnailMock).not.toHaveBeenCalled();
    expect(updateThumbnailMock).not.toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledTimes(1);

    const betaId = createManualBetaMock.mock.calls[0][0].id;
    await afterMock.mock.calls[0][0]();
    expect(acquireThumbnailMock).toHaveBeenCalledWith(
      expect.objectContaining({ betaId, platform: "youtube" })
    );
    expect(updateThumbnailMock).toHaveBeenCalledWith(betaId, "https://cdn.granite.kr/beta/x/thumb.jpg");
  });

  it("swallows deferred thumbnail failures without touching the beta row", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue(null);
    findByPermalinkMock.mockResolvedValue(null);
    acquireThumbnailMock.mockRejectedValue(new Error("oEmbed down"));

    const result = await addRecordAction(
      formDataOf({ routeId: "route_1", sentAt: "2026-07-09", mediaUrl: "https://youtu.be/abc123" })
    );

    expect(result.ok).toBe(true);
    await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(updateThumbnailMock).not.toHaveBeenCalled();
  });

  it("rejects duplicates found by permalink when the external media lookup misses", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue(null);
    findByPermalinkMock.mockResolvedValue({ id: "beta_existing" });

    const result = await addRecordAction(
      formDataOf({ routeId: "route_1", sentAt: "2026-07-09", mediaUrl: "https://youtu.be/abc123" })
    );

    expect(result).toEqual({ ok: false, message: "이미 등록된 영상입니다." });
    expect(createManualBetaMock).not.toHaveBeenCalled();
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });
});

describe("searchRoutesForRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps rows and parses hashtags", async () => {
    searchRoutesMock.mockResolvedValue([
      {
        routeId: "route_1",
        routeName: "Honey No.6",
        routeGrade: "V6",
        boulderName: "허니 볼더",
        sectorName: "허니1",
        cragName: "안양예술공원",
        boulderHashtags: '["안양_허니넘버6"]'
      }
    ]);

    const results = await searchRoutesForRecordAction("honey");

    expect(searchRoutesMock).toHaveBeenCalledWith("honey");
    expect(results).toEqual([
      expect.objectContaining({
        routeId: "route_1",
        boulderHashtags: ["안양_허니넘버6"]
      })
    ]);
  });
});
