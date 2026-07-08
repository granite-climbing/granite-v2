// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectRoutesView } from "./project-routes-view";
import type { SavedRouteListItem } from "@/lib/db/schema";

const removeAction = vi.fn();

function makeRoute(
  overrides: Pick<SavedRouteListItem, "favoriteId" | "id" | "name" | "grade" | "gradeNum" | "cragName">
): SavedRouteListItem {
  return {
    savedAt: "2026-07-07 10:00:00",
    topoId: `topo_${overrides.id}`,
    slug: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    fa: "Unknown",
    description: "Route description",
    lineImageUrl: `https://cdn.granite.kr/routes/${overrides.id}/line.jpg`,
    isPublished: true,
    sortOrder: 1,
    boulderId: `boulder_${overrides.id}`,
    boulderName: `${overrides.name} 볼더`,
    sectorName: "메인 섹터",
    cragSlug: "crag",
    sectorSlug: "main",
    ...overrides
  };
}

const routes: SavedRouteListItem[] = [
  makeRoute({ favoriteId: "fav_1", id: "route_1", name: "Little Finger", grade: "V5", gradeNum: 5, cragName: "현충바위" }),
  makeRoute({
    favoriteId: "fav_2",
    id: "route_2",
    name: "Crimp Master",
    grade: "V11",
    gradeNum: 11,
    cragName: "더 클라임 성수"
  }),
  makeRoute({ favoriteId: "fav_3", id: "route_3", name: "Slab Queen", grade: "V5", gradeNum: 5, cragName: "인수봉" })
];

describe("ProjectRoutesView", () => {
  it("renders the search field and all route cards by default with no group headers", () => {
    render(<ProjectRoutesView routes={routes} removeAction={removeAction} />);

    expect(screen.getByPlaceholderText("문제, 볼더, 섹터, 암장, 난이도 검색")).toBeInTheDocument();
    expect(screen.getByText("Little Finger")).toBeInTheDocument();
    expect(screen.getByText("Crimp Master")).toBeInTheDocument();
    expect(screen.getByText("Slab Queen")).toBeInTheDocument();
    // No group headers in the default (최신순) view.
    expect(screen.queryByText("V11")).not.toBeInTheDocument();
    expect(screen.queryByText("현충바위", { selector: "p" })).not.toBeInTheDocument();
  });

  it("groups by grade in descending gradeNum order when the Grade chip is active", () => {
    render(<ProjectRoutesView routes={routes} removeAction={removeAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Grade" }));

    const v11Label = screen.getByText("V11");
    const v5Label = screen.getByText("V5");
    expect(v11Label.compareDocumentPosition(v5Label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("groups by crag name when the Crag chip is active", () => {
    render(<ProjectRoutesView routes={routes} removeAction={removeAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Crag" }));

    expect(screen.getByText("더 클라임 성수")).toBeInTheDocument();
    expect(screen.getByText("현충바위")).toBeInTheDocument();
    expect(screen.getByText("인수봉")).toBeInTheDocument();
  });

  it("filters the list by search query and shows an empty message when nothing matches", () => {
    render(<ProjectRoutesView routes={routes} removeAction={removeAction} />);

    const input = screen.getByPlaceholderText("문제, 볼더, 섹터, 암장, 난이도 검색");
    fireEvent.change(input, { target: { value: "Little" } });

    expect(screen.getByText("Little Finger")).toBeInTheDocument();
    expect(screen.queryByText("Crimp Master")).not.toBeInTheDocument();
    expect(screen.queryByText("Slab Queen")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "존재하지않는검색어" } });
    expect(screen.getByText("검색 결과가 없습니다")).toBeInTheDocument();
  });

  it("reflects the active sort chip via aria-pressed", () => {
    render(<ProjectRoutesView routes={routes} removeAction={removeAction} />);

    const latestChip = screen.getByRole("button", { name: "최신순" });
    const gradeChip = screen.getByRole("button", { name: "Grade" });
    expect(latestChip).toHaveAttribute("aria-pressed", "true");
    expect(gradeChip).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(gradeChip);

    expect(latestChip).toHaveAttribute("aria-pressed", "false");
    expect(gradeChip).toHaveAttribute("aria-pressed", "true");
  });
});
