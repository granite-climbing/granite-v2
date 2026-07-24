"use client";

// The default React import is required: vitest compiles JSX with the classic runtime.
import React, { useMemo, useState } from "react";
import type { ProjectActionResult } from "@/lib/actions/project";
import type { SavedRouteListItem } from "@/lib/db/schema";
import { ProjectRouteCard } from "./project-route-card";

type SortMode = "latest" | "grade" | "crag";

type ProjectRoutesViewProps = {
  routes: SavedRouteListItem[];
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
};

type RouteGroup = {
  label: string | null;
  routes: SavedRouteListItem[];
};

const SORT_CHIPS: Array<{ mode: SortMode; label: string }> = [
  { mode: "latest", label: "최신순" },
  { mode: "grade", label: "Grade" },
  { mode: "crag", label: "Crag" }
];

export function ProjectRoutesView({ routes, removeAction }: ProjectRoutesViewProps) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const filteredRoutes = useMemo(() => filterRoutes(routes, query), [routes, query]);
  const groups = useMemo(() => groupRoutes(filteredRoutes, sortMode), [filteredRoutes, sortMode]);

  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F5F5F5] pb-[90px]">
      <header className="bg-[#121212] px-4 pb-4 pt-4 text-white">
        <div className="flex h-8 items-center justify-between">
          <h1 className="text-[20px] font-bold leading-7">프로젝트</h1>
        </div>
        <div className="relative mt-4">
          <label>
            <span className="sr-only">검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="문제, 볼더, 섹터, 암장, 난이도 검색"
              autoComplete="off"
              className="h-11 w-full rounded-full border-0 bg-white px-4 pr-11 text-[14px] font-medium text-black outline-none placeholder:text-[#B8B8B8]"
            />
          </label>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#B8B8B8]"
          >
            <SearchIcon className="size-4" />
          </span>
        </div>
      </header>

      {routes.length === 0 ? (
        <section className="grid min-h-[50vh] place-items-center px-5 text-center">
          <div>
            <h2 className="text-[20px] font-black leading-7 text-black">저장한 프로젝트가 없습니다</h2>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[#6F7477]">
              Route 상세에서 프로젝트 저장을 누르면 이곳에 표시됩니다.
            </p>
          </div>
        </section>
      ) : (
        <section className="px-4 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-6 text-black">저장한 루트</h2>
            <div className="flex items-center gap-1.5">
              {SORT_CHIPS.map((chip) => {
                const active = sortMode === chip.mode;
                return (
                  <button
                    key={chip.mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSortMode(chip.mode)}
                    className={`h-6 rounded-full px-3 text-[12px] font-semibold ${
                      active ? "bg-[#121212] text-white" : "bg-[#E8E8E8] text-[#B8B8B8]"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRoutes.length === 0 ? (
            <p className="mt-10 text-center text-[13px] font-medium text-[#8A8A8A]">검색 결과가 없습니다</p>
          ) : (
            <div className="mt-3 space-y-3">
              {groups.map((group) => (
                <div key={group.label ?? "__flat__"}>
                  {group.label ? (
                    <p className="mb-2 text-[13px] font-medium text-[#5A5A5A]">{group.label}</p>
                  ) : null}
                  <div className="space-y-3">
                    {group.routes.map((route) => (
                      <ProjectRouteCard key={route.favoriteId} route={route} removeAction={removeAction} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function filterRoutes(routes: SavedRouteListItem[], query: string): SavedRouteListItem[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return routes;
  }

  return routes.filter((route) =>
    [route.name, route.boulderName, route.sectorName, route.cragName, route.grade].some((field) =>
      field.toLowerCase().includes(trimmed)
    )
  );
}

function groupRoutes(routes: SavedRouteListItem[], sortMode: SortMode): RouteGroup[] {
  if (sortMode === "latest") {
    return [{ label: null, routes }];
  }

  if (sortMode === "grade") {
    const order: string[] = [];
    const byGrade = new Map<string, { gradeNum: number; routes: SavedRouteListItem[] }>();

    for (const route of routes) {
      if (!byGrade.has(route.grade)) {
        byGrade.set(route.grade, { gradeNum: route.gradeNum, routes: [] });
        order.push(route.grade);
      }
      byGrade.get(route.grade)!.routes.push(route);
    }

    return [...order]
      .sort((a, b) => byGrade.get(b)!.gradeNum - byGrade.get(a)!.gradeNum)
      .map((grade) => ({ label: grade, routes: byGrade.get(grade)!.routes }));
  }

  const order: string[] = [];
  const byCrag = new Map<string, SavedRouteListItem[]>();

  for (const route of routes) {
    if (!byCrag.has(route.cragName)) {
      byCrag.set(route.cragName, []);
      order.push(route.cragName);
    }
    byCrag.get(route.cragName)!.push(route);
  }

  return [...order]
    .sort((a, b) => a.localeCompare(b, "ko"))
    .map((cragName) => ({ label: cragName, routes: byCrag.get(cragName)! }));
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20l-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
