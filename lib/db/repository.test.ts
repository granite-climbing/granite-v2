import { describe, expect, it } from "vitest";
import {
  findBoulderById,
  findCragBySlug,
  findRouteById,
  getHomeModel,
  parseBoulderHashtags
} from "./repository";

describe("content repository", () => {
  it("builds the home model with area statistics and published crag cards", () => {
    const model = getHomeModel();

    expect(model.totals).toEqual({ crags: 2, sectors: 3, boulders: 4, routes: 7 });
    expect(model.areas[0]).toMatchObject({
      name: "수도권",
      stats: { crags: 2, sectors: 3, boulders: 4, routes: 7 }
    });
    expect(model.areas[0]?.crags.map((crag) => crag.slug)).toEqual(["moraksan", "anyang"]);
  });

  it("returns Crag detail scoped to sectors, boulders, and routes", () => {
    const crag = findCragBySlug("moraksan");

    expect(crag?.tabs).toEqual(["Info", "Sector", "Boulder", "Route", "Map", "Travel"]);
    expect(crag?.sectors.map((sector) => sector.slug)).toEqual(["gamja", "gyewon"]);
    expect(crag?.boulders.map((boulder) => boulder.name)).toContain("큰바위");
    expect(crag?.routes.map((route) => route.name)).toContain("Sky Hook");
  });

  it("returns Route detail with its full hierarchy", () => {
    const route = findRouteById("route-sky-hook");

    expect(route).toMatchObject({
      id: "route-sky-hook",
      name: "Sky Hook",
      grade: "V5",
      boulderName: "큰바위",
      sectorName: "감자",
      cragName: "모락산"
    });
  });

  it("parses boulder hashtag JSON defensively", () => {
    expect(parseBoulderHashtags("[\"모락산\", \"슬랩\"]")).toEqual(["모락산", "슬랩"]);
    expect(parseBoulderHashtags("not json")).toEqual([]);
    expect(parseBoulderHashtags("[1, \"valid\", null]")).toEqual(["valid"]);
  });

  it("finds a boulder with topos and routes for the bottomsheet page", () => {
    const boulder = findBoulderById("boulder-big");

    expect(boulder?.topos[0]?.routes.map((route) => route.id)).toEqual([
      "route-sky-hook",
      "route-river-stone"
    ]);
  });
});
