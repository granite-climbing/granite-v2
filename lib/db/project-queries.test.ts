import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRouteFavorite,
  findPublishedRouteForFavorite,
  isRouteFavoritedByUser,
  listFavoritedRouteIdsForUser,
  listSavedRoutesForUser,
  removeRouteFavorite
} from "./project-queries";

const queryD1Mock = vi.hoisted(() => vi.fn());
const queryD1FirstMock = vi.hoisted(() => vi.fn());
const executeD1Mock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock,
  queryD1First: queryD1FirstMock,
  executeD1: executeD1Mock
}));

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock
}));

describe("project queries", () => {
  beforeEach(() => {
    queryD1Mock.mockReset();
    queryD1FirstMock.mockReset();
    executeD1Mock.mockReset();
    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValue("favorite-uuid");
  });

  it("lists saved routes for a user newest first", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        favoriteId: "fav_1",
        savedAt: "2026-07-07 10:00:00",
        id: "route_1",
        topoId: "topo_1",
        name: "Little Finger",
        slug: "little-finger",
        grade: "V5",
        gradeNum: 5,
        fa: "Unknown",
        description: "Route description",
        lineImageUrl: "https://cdn.granite.kr/routes/route_1/line.jpg",
        isPublished: 1,
        sortOrder: 1,
        boulderId: "boulder_1",
        boulderName: "리틀핑거 바위",
        sectorName: "메인 섹터",
        cragName: "현충바위",
        cragSlug: "hyeonchung",
        sectorSlug: "main"
      }
    ]);

    const routes = await listSavedRoutesForUser("user_1");

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("FROM favorites f"), ["user_1"]);
    expect(queryD1Mock.mock.calls[0][0]).toContain("ORDER BY f.created_at DESC");
    expect(routes).toEqual([
      expect.objectContaining({
        favoriteId: "fav_1",
        savedAt: "2026-07-07 10:00:00",
        id: "route_1",
        name: "Little Finger",
        isPublished: true,
        cragName: "현충바위"
      })
    ]);
  });

  it("checks that a route is published before saving", async () => {
    queryD1FirstMock.mockResolvedValueOnce({ id: "route_1" });

    const route = await findPublishedRouteForFavorite("route_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(expect.stringContaining("WHERE r.id = ?"), ["route_1"]);
    expect(queryD1FirstMock.mock.calls[0][0]).toContain("r.is_published = 1");
    expect(route).toEqual({ id: "route_1" });
  });

  it("adds a route favorite idempotently", async () => {
    await addRouteFavorite("user_1", "route_1");

    expect(executeD1Mock).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE INTO favorites"), [
      "fav_favorite-uuid",
      "user_1",
      "route",
      "route_1"
    ]);
  });

  it("removes a route favorite for the current user", async () => {
    await removeRouteFavorite("user_1", "route_1");

    expect(executeD1Mock).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM favorites"), [
      "user_1",
      "route",
      "route_1"
    ]);
  });

  it("checks whether a route is already saved", async () => {
    queryD1FirstMock.mockResolvedValueOnce({ id: "fav_1" });

    const saved = await isRouteFavoritedByUser("user_1", "route_1");

    expect(saved).toBe(true);
    expect(queryD1FirstMock).toHaveBeenCalledWith(expect.stringContaining("LIMIT 1"), [
      "user_1",
      "route",
      "route_1"
    ]);
  });

  it("batch checks favorited route ids for a user", async () => {
    queryD1Mock.mockResolvedValueOnce([{ targetId: "route_1" }]);

    const favorited = await listFavoritedRouteIdsForUser("user_1", ["route_1", "route_2"]);

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("IN (?, ?)"), [
      "user_1",
      "route",
      "route_1",
      "route_2"
    ]);
    expect(favorited).toEqual(new Set(["route_1"]));
  });

  it("returns an empty set without querying when routeIds is empty", async () => {
    const favorited = await listFavoritedRouteIdsForUser("user_1", []);

    expect(favorited).toEqual(new Set());
    expect(queryD1Mock).not.toHaveBeenCalled();
  });
});
