import { describe, expect, it } from "vitest";
import {
  parseAreaForm,
  parseBoulderForm,
  parseCragForm,
  parseRouteForm,
  parseTopoForm,
} from "./admin-content-schema";

describe("admin content form parsing", () => {
  it("parses crag fields matching Phase 2 schema", () => {
    const parsed = parseCragForm({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      description: "지하철 접근 가능",
      lat: "37.4194",
      lng: "126.9323",
      season: "2월 말 ~ 5월 말",
      coverImageUrl: "https://cdn.granite.kr/crags/anyang/cover.webp",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed).toMatchObject({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      description: "지하철 접근 가능",
      lat: 37.4194,
      lng: 126.9323,
      isPublished: true,
      sortOrder: 1,
    });
  });

  it("normalizes boulder hashtags into JSON text", () => {
    const parsed = parseBoulderForm({
      id: "boulder_gomul_boulder",
      sectorId: "sector_anyang_antique",
      name: "고물 볼더",
      slug: "gomul_boulder",
      lat: "37.423499",
      lng: "126.92643",
      hashtags: "#안양, 고물",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed.hashtags).toBe(JSON.stringify(["안양", "고물"]));
  });

  it("rejects routes without topo id", () => {
    expect(() =>
      parseRouteForm({
        id: "route_anaconda",
        topoId: "",
        name: "아나콘다",
        slug: "anaconda",
        grade: "V5",
        gradeNum: "5",
        fa: "",
        description: "",
        lineImageUrl: "",
        isPublished: "on",
        sortOrder: "1",
      }),
    ).toThrow();
  });
});
