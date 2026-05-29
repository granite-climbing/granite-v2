import { describe, expect, it } from "vitest";
import {
  parseAreaForm,
  parseBoulderForm,
  parseCragForm,
  parseRouteForm,
  parseSectorForm,
  parseTopoForm,
} from "./admin-content-schema";
import { parseGradeNum } from "@/lib/db/import-normalize";

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

  it("parses area form happy path", () => {
    const parsed = parseAreaForm({
      id: "area_greater_seoul",
      name: "수도권",
      slug: "greater_seoul",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "0",
    });

    expect(parsed).toMatchObject({
      id: "area_greater_seoul",
      name: "수도권",
      slug: "greater_seoul",
      coverImageUrl: "",
      isPublished: true,
      sortOrder: 0,
    });
  });

  it("parses sector form happy path (uses cragId)", () => {
    const parsed = parseSectorForm({
      id: "sector_anyang_antique",
      cragId: "crag_anyang",
      name: "앤틱 구역",
      slug: "anyang_antique",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "0",
    });

    expect(parsed).toMatchObject({
      id: "sector_anyang_antique",
      cragId: "crag_anyang",
      name: "앤틱 구역",
      slug: "anyang_antique",
      isPublished: true,
      sortOrder: 0,
    });
  });

  it("parses topo form happy path", () => {
    const parsed = parseTopoForm({
      id: "topo_gomul_front",
      boulderId: "boulder_gomul_boulder",
      name: "고물 정면",
      baseImageUrl: "",
      isPublished: "on",
      sortOrder: "0",
    });

    expect(parsed).toMatchObject({
      id: "topo_gomul_front",
      boulderId: "boulder_gomul_boulder",
      name: "고물 정면",
      baseImageUrl: "",
      isPublished: true,
      sortOrder: 0,
    });
  });

  it("derives gradeNum from grade when gradeNum is blank", () => {
    const parsed = parseRouteForm({
      id: "route_anaconda",
      topoId: "topo_gomul_front",
      name: "아나콘다",
      slug: "anaconda",
      grade: "V5",
      gradeNum: "",
      fa: "",
      description: "",
      lineImageUrl: "",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed.gradeNum).toBe(parseGradeNum("V5"));
  });

  it("rejects crag form with R2 direct URL as coverImageUrl", () => {
    expect(() =>
      parseCragForm({
        id: "crag_anyang",
        areaId: "area_greater_seoul",
        name: "안양",
        slug: "anyang",
        coverImageUrl: "https://granite-v2.r2.cloudflarestorage.com/x.jpg",
        isPublished: "on",
        sortOrder: "0",
      }),
    ).toThrow();
  });
});
