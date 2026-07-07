import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_SESSION_COOKIE_NAME, createUserSessionToken } from "@/lib/auth/session";
import {
  addRouteFavorite,
  findPublishedRouteForFavorite,
  removeRouteFavorite
} from "@/lib/db/project-queries";
import { saveRouteProjectAction, removeRouteProjectAction } from "./project";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const revalidatePathMock = vi.hoisted(() => vi.fn());
const addRouteFavoriteMock = vi.hoisted(() => vi.fn());
const removeRouteFavoriteMock = vi.hoisted(() => vi.fn());
const findPublishedRouteForFavoriteMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/db/project-queries", () => ({
  addRouteFavorite: addRouteFavoriteMock,
  removeRouteFavorite: removeRouteFavoriteMock,
  findPublishedRouteForFavorite: findPublishedRouteForFavoriteMock
}));

describe("project actions", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "project-action-test-secret";
    cookiesMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockReset();
    addRouteFavoriteMock.mockReset();
    removeRouteFavoriteMock.mockReset();
    findPublishedRouteForFavoriteMock.mockReset();
  });

  it("redirects anonymous users to login when saving", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/t/topo_1?route=route_1");

    await expect(saveRouteProjectAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login?returnTo=%2Ft%2Ftopo_1%3Froute%3Droute_1"
    );
  });

  it("falls back to /me/projects when returnTo is a malicious absolute URL", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const formData1 = new FormData();
    formData1.set("routeId", "route_1");
    formData1.set("returnTo", "https://evil.example");

    await expect(saveRouteProjectAction(formData1)).rejects.toThrow(
      "NEXT_REDIRECT:/login?returnTo=%2Fme%2Fprojects"
    );

    const formData2 = new FormData();
    formData2.set("routeId", "route_1");
    formData2.set("returnTo", "//evil.example");

    await expect(saveRouteProjectAction(formData2)).rejects.toThrow(
      "NEXT_REDIRECT:/login?returnTo=%2Fme%2Fprojects"
    );
  });

  it("saves a published route for the logged-in user", async () => {
    const token = await createUserSessionToken({ userId: "user_1" });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: token } : undefined)
    });
    findPublishedRouteForFavoriteMock.mockResolvedValue({ id: "route_1" });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/t/topo_1?route=route_1");

    const result = await saveRouteProjectAction(formData);

    expect(findPublishedRouteForFavorite).toHaveBeenCalledWith("route_1");
    expect(addRouteFavorite).toHaveBeenCalledWith("user_1", "route_1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/me/projects");
    expect(revalidatePathMock).toHaveBeenCalledWith("/t/topo_1");
    expect(result).toEqual({ ok: true, message: "프로젝트에 저장했습니다." });
  });

  it("rejects an unpublished or missing route", async () => {
    const token = await createUserSessionToken({ userId: "user_1" });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: token } : undefined)
    });
    findPublishedRouteForFavoriteMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("routeId", "route_missing");
    formData.set("returnTo", "/me/projects");

    const result = await saveRouteProjectAction(formData);

    expect(result).toEqual({ ok: false, message: "저장할 수 없는 루트입니다." });
    expect(addRouteFavoriteMock).not.toHaveBeenCalled();
  });

  it("redirects anonymous users to login when removing", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/me/projects");

    await expect(removeRouteProjectAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login?returnTo=%2Fme%2Fprojects"
    );
    expect(removeRouteFavoriteMock).not.toHaveBeenCalled();
  });

  it("removes a route favorite for the logged-in user", async () => {
    const token = await createUserSessionToken({ userId: "user_1" });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: token } : undefined)
    });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/me/projects");

    const result = await removeRouteProjectAction(formData);

    expect(removeRouteFavorite).toHaveBeenCalledWith("user_1", "route_1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/me/projects");
    expect(result).toEqual({ ok: true, message: "프로젝트에서 제거했습니다." });
  });
});
