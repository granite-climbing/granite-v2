import { describe, expect, it } from "vitest";
import {
  parseBoulderForm,
  parseCragForm,
  parseRouteForm
} from "./admin-content-schema";

describe("admin content form parsing", () => {
  it("parses a crag form payload with optional coordinates", () => {
    const parsed = parseCragForm({
      areaId: "area-capital",
      name: "모락산",
      slug: "moraksan",
      lat: "37.37",
      lng: "126.97",
      summary: "summary",
      accessDesc: "access",
      parkingDesc: "parking",
      season: "winter",
      coverImageUrl: "https://cdn.granite.kr/crags/moraksan.jpg",
      isPublished: "on"
    });

    expect(parsed).toMatchObject({ lat: 37.37, lng: 126.97, isPublished: true });
  });

  it("normalizes boulder hashtags into JSON text", () => {
    const parsed = parseBoulderForm({
      sectorId: "sector-gamja",
      name: "큰바위",
      slug: "big-rock",
      lat: "37.1",
      lng: "126.1",
      coordPrecision: "exact",
      rockType: "granite",
      hashtags: "#모락산, 슬랩  ,",
      coverImageUrl: "",
      isPublished: "on"
    });

    expect(parsed.hashtags).toBe("[\"모락산\",\"슬랩\"]");
  });

  it("rejects invalid route grade numbers", () => {
    expect(() =>
      parseRouteForm({
        topoId: "topo",
        boulderId: "boulder",
        name: "Sky Hook",
        slug: "sky-hook",
        grade: "V5",
        gradeNum: "not-number",
        fa: "",
        description: "",
        lineImageUrl: "",
        isPublished: "on"
      })
    ).toThrow();
  });
});
