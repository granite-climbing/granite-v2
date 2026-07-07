// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectRouteCard } from "./project-route-card";
import type { SavedRouteListItem } from "@/lib/db/schema";

const removeAction = vi.fn();

const route: SavedRouteListItem = {
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
  isPublished: true,
  sortOrder: 1,
  boulderId: "boulder_1",
  boulderName: "리틀핑거 바위",
  sectorName: "메인 섹터",
  cragName: "현충바위",
  cragSlug: "hyeonchung",
  sectorSlug: "main"
};

describe("ProjectRouteCard", () => {
  it("renders saved route context", () => {
    render(<ProjectRouteCard route={route} removeAction={removeAction} />);

    expect(screen.getByRole("link", { name: "Little Finger V5" })).toHaveAttribute(
      "href",
      "/t/topo_1?route=route_1"
    );
    expect(screen.getByText("현충바위 · 메인 섹터 · 리틀핑거 바위")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로젝트에서 제거" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("route_1")).toHaveAttribute("name", "routeId");
  });
});
