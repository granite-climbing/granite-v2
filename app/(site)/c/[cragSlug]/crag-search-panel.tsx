"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CragDetail, RouteListItem, TabName } from "@/lib/db/schema";
import { bucketGradeNums, GRADE_LABELS } from "@/lib/grade-histogram";

type RouteSort = "grade:asc" | "grade:desc" | "boulder:asc" | "boulder:desc" | "";
type SearchableTab = Extract<TabName, "Sector" | "Boulder" | "Route">;

export function CragSearchPanel({
  crag,
  activeTab,
  initialQuery,
  sort,
  sectorId,
  boulderId,
  basePath,
}: {
  crag: CragDetail;
  activeTab: SearchableTab;
  initialQuery: string;
  sort: RouteSort;
  sectorId: string;
  boulderId: string;
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const paramQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    setQuery(paramQuery);
  }, [paramQuery]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed === paramQuery) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTab.toLowerCase());
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }, 600);

    return () => window.clearTimeout(handle);
  }, [activeTab, pathname, query, router, searchParams, paramQuery]);

  if (activeTab === "Sector") {
    const filtered = filterSectors(crag, query);

    return (
      <section className="pt-4">
        <SectionHeading />
        <div className="mt-4">
          <ClientSearchInput value={query} onChange={setQuery} placeholder="섹터 이름 검색" />
        </div>
        <div className="mt-4 space-y-3 px-4">
          {filtered.length === 0 ? (
            <EmptyResult query={query} />
          ) : (
            filtered.map((sector) => (
              <div key={sector.id} id={`sector-card-${sector.id}`}>
                <SectorCard
                  sector={sector}
                  cragSlug={crag.slug}
                  boulderCount={crag.boulders.filter((b) => b.sectorId === sector.id).length}
                  routes={crag.routes.filter((r) => r.sectorSlug === sector.slug)}
                />
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "Boulder") {
    const filtered = filterBoulders(crag, query);

    return (
      <section className="pt-4">
        <SectionHeading />
        <div className="mt-4">
          <ClientSearchInput value={query} onChange={setQuery} placeholder="볼더 이름 검색" />
        </div>
        <div className="mt-4 space-y-3 px-4">
          {filtered.length === 0 ? (
            <EmptyResult query={query} />
          ) : (
            filtered.map((boulder) => (
              <div key={boulder.id} id={`boulder-card-${boulder.id}`}>
                <BoulderListCard
                  boulder={boulder}
                  cragSlug={crag.slug}
                  routes={crag.routes.filter((r) => r.boulderId === boulder.id)}
                />
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  const activeSector = sectorId ? crag.sectors.find((sector) => sector.id === sectorId) : undefined;
  const activeBoulder = boulderId ? crag.boulders.find((boulder) => boulder.id === boulderId) : undefined;
  const filteredRoutes = filterRoutes(crag.routes, query, activeSector?.slug ?? "", boulderId);
  const sortedRoutes = sortRoutes(filteredRoutes, sort);
  const clearFilterParams = new URLSearchParams({ tab: "route" });
  if (query.trim()) clearFilterParams.set("q", query.trim());
  if (sort) clearFilterParams.set("sort", sort);
  const clearFilterHref = `${basePath}?${clearFilterParams.toString()}`;
  const filterLabel = activeBoulder
    ? `볼더 필터 적용 중: ${activeBoulder.name}`
    : activeSector
      ? `섹터 필터 적용 중: ${activeSector.name}`
      : "";

  return (
    <section className="pt-4">
      <SectionHeading />
      {filterLabel ? (
        <div className="mb-3 mt-3 flex items-center justify-center gap-2 px-4 text-[12px] text-[#7A7A7A]">
          <span>{filterLabel}</span>
          <Link href={clearFilterHref} className="underline">
            필터 해제
          </Link>
        </div>
      ) : null}
      <div className="mt-4">
        <ClientSearchInput value={query} onChange={setQuery} placeholder="루트 이름 검색" />
      </div>
      <div className="mt-4 px-4">
        {sortedRoutes.length === 0 ? (
          <EmptyResult query={query} />
        ) : (
          <RouteTable
            routes={sortedRoutes}
            sort={sort}
            query={query}
            sectorId={sectorId}
            boulderId={boulderId}
            basePath={basePath}
          />
        )}
      </div>
    </section>
  );
}

function ClientSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mx-4">
      <label>
        <span className="sr-only">검색</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 w-full rounded-full border-0 bg-white px-4 pr-12 text-[14px] font-medium leading-5 text-[#090909] shadow-[0_0_6px_2px_rgba(0,0,0,0.1)] outline-none placeholder:text-[#B8B8B8] focus:shadow-[0_0_6px_2px_rgba(0,0,0,0.18)]"
        />
      </label>
      <span className="pointer-events-none absolute right-4 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-[#090909]">
        <SearchIcon />
      </span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="none">
      <path
        d="m20 20-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function filterSectors(crag: CragDetail, query: string) {
  const q = normalizeQuery(query);
  if (!q) return crag.sectors;
  return crag.sectors.filter((sector) => sector.name.toLowerCase().includes(q));
}

function filterBoulders(crag: CragDetail, query: string) {
  const q = normalizeQuery(query);
  if (!q) return crag.boulders;
  return crag.boulders.filter((boulder) => boulder.name.toLowerCase().includes(q));
}

function filterRoutes(routes: RouteListItem[], query: string, sectorSlug: string, boulderId: string) {
  const scopedRoutes = boulderId
    ? routes.filter((route) => route.boulderId === boulderId)
    : sectorSlug
      ? routes.filter((route) => route.sectorSlug === sectorSlug)
      : routes;
  const q = normalizeQuery(query);
  if (!q) return scopedRoutes;
  return scopedRoutes.filter((route) => route.name.toLowerCase().includes(q));
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function sortRoutes(routes: RouteListItem[], sort: RouteSort) {
  if (sort === "grade:asc") {
    return [...routes].sort((a, b) => a.gradeNum - b.gradeNum || a.grade.localeCompare(b.grade));
  }
  if (sort === "grade:desc") {
    return [...routes].sort((a, b) => b.gradeNum - a.gradeNum || b.grade.localeCompare(a.grade));
  }
  if (sort === "boulder:asc") {
    return [...routes].sort(
      (a, b) =>
        a.boulderName.localeCompare(b.boulderName) ||
        a.name.localeCompare(b.name) ||
        a.gradeNum - b.gradeNum
    );
  }
  if (sort === "boulder:desc") {
    return [...routes].sort(
      (a, b) =>
        b.boulderName.localeCompare(a.boulderName) ||
        a.name.localeCompare(b.name) ||
        a.gradeNum - b.gradeNum
    );
  }
  return routes;
}

function SectionHeading() {
  return (
    <p className="text-center text-[16px] font-bold leading-6 text-[#090909]">
      FIND YOUR NEXT DREAM!
    </p>
  );
}

function EmptyResult({ query }: { query: string }) {
  return (
    <p className="py-8 text-center text-[14px] font-normal leading-5 text-[#7A7A7A]">
      &ldquo;{query}&rdquo; 에 해당하는 결과가 없습니다.
    </p>
  );
}

function SectorCard({
  sector,
  cragSlug,
  boulderCount,
  routes,
}: {
  sector: CragDetail["sectors"][number];
  cragSlug: string;
  boulderCount: number;
  routes: RouteListItem[];
}) {
  return (
    <Link
      href={`/c/${cragSlug}?tab=route&sectorId=${encodeURIComponent(sector.id)}`}
      className="flex h-[100px] items-center overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]"
    >
      <div
        className="ml-2 size-[84px] shrink-0 self-center rounded-[4px] bg-[#D9D9D9] bg-cover bg-center"
        style={sector.coverImageUrl ? { backgroundImage: `url("${sector.coverImageUrl}")` } : undefined}
      />
      <div className="flex flex-1 flex-col justify-center pl-3 pr-2">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">{sector.name}</h2>
        <p className="mt-[2px] text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
          {boulderCount} Boulders · {routes.length} Routes
        </p>
        <MiniGradeBars routes={routes} barWidth={6} maxHeight={20} className="mt-2" />
      </div>
      <div className="flex shrink-0 items-center pr-2">
        <span className="text-[18px] leading-none text-[#7A7A7A]">›</span>
      </div>
    </Link>
  );
}

function MiniGradeBars({
  routes,
  barWidth,
  maxHeight,
  className,
}: {
  routes: RouteListItem[];
  barWidth: number;
  maxHeight: number;
  className?: string;
}) {
  const bars = bucketGradeNums(routes);
  const max = Math.max(...bars, 1);
  return (
    <div
      className={`flex items-end gap-[2px]${className ? ` ${className}` : ""}`}
      aria-label="V등급 분포"
    >
      {bars.map((count, i) => (
        <div
          key={GRADE_LABELS[i]}
          className="rounded-[2px] bg-[#7A7A7A]"
          style={{
            width: `${barWidth}px`,
            height: `${count === 0 ? 2 : Math.max(2, Math.round((count / max) * maxHeight))}px`,
            opacity: count === 0 ? 0.25 : 1,
          }}
        />
      ))}
    </div>
  );
}

function BoulderListCard({
  boulder,
  cragSlug,
  routes,
}: {
  boulder: CragDetail["boulders"][number];
  cragSlug: string;
  routes: RouteListItem[];
}) {
  return (
    <Link
      href={`/c/${cragSlug}?tab=route&boulderId=${encodeURIComponent(boulder.id)}`}
      className="flex h-[100px] items-center overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]"
    >
      <div
        className="ml-2 size-[84px] shrink-0 self-center rounded-[4px] bg-[#D9D9D9] bg-cover bg-center"
        style={
          boulder.coverImageUrl
            ? { backgroundImage: `url("${boulder.coverImageUrl}")` }
            : undefined
        }
      />
      <div className="flex flex-1 flex-col justify-center pl-3 pr-2">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">{boulder.name}</h2>
        <p className="mt-[2px] text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
          {boulder.routeCount} Routes
        </p>
        <MiniGradeBars routes={routes} barWidth={6} maxHeight={20} className="mt-2" />
      </div>
      <div className="flex shrink-0 items-center pr-2">
        <span className="text-[18px] leading-none text-[#7A7A7A]">›</span>
      </div>
    </Link>
  );
}

function nextRouteSortHref({
  basePath,
  query,
  sort,
  sectorId,
  boulderId,
  field,
}: {
  basePath: string;
  query: string;
  sort: RouteSort;
  sectorId: string;
  boulderId: string;
  field: "grade" | "boulder";
}): string {
  const asc = `${field}:asc` as RouteSort;
  const desc = `${field}:desc` as RouteSort;
  const nextSort: RouteSort = sort === asc ? desc : sort === desc ? "" : asc;
  const params = new URLSearchParams({ tab: "route" });
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (nextSort) params.set("sort", nextSort);
  if (sectorId) params.set("sectorId", sectorId);
  if (boulderId) params.set("boulderId", boulderId);
  return `${basePath}?${params.toString()}`;
}

function SortIcon({ active }: { active: "asc" | "desc" | "" }) {
  if (active === "asc") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 10 10"
        className="ml-1 inline-block size-[10px] shrink-0 align-middle"
        fill="currentColor"
      >
        <path d="M5 1 L9 8 L1 8 Z" />
      </svg>
    );
  }
  if (active === "desc") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 10 10"
        className="ml-1 inline-block size-[10px] shrink-0 align-middle"
        fill="currentColor"
      >
        <path d="M5 9 L9 2 L1 2 Z" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 14"
      className="ml-1 inline-block size-[10px] shrink-0 align-middle text-[#B8B8B8]"
      fill="currentColor"
    >
      <path d="M5 1 L8.5 5.5 L1.5 5.5 Z" />
      <path d="M5 13 L8.5 8.5 L1.5 8.5 Z" />
    </svg>
  );
}

function RouteTable({
  routes,
  sort,
  query,
  sectorId,
  boulderId,
  basePath,
}: {
  routes: RouteListItem[];
  sort: RouteSort;
  query: string;
  sectorId: string;
  boulderId: string;
  basePath: string;
}) {
  const gradeHref = nextRouteSortHref({ basePath, query, sort, sectorId, boulderId, field: "grade" });
  const boulderHref = nextRouteSortHref({ basePath, query, sort, sectorId, boulderId, field: "boulder" });
  const gradeSort = sort === "grade:asc" ? "asc" : sort === "grade:desc" ? "desc" : "";
  const boulderSort = sort === "boulder:asc" ? "asc" : sort === "boulder:desc" ? "desc" : "";
  return (
    <div>
      <div className="grid h-10 grid-cols-[1fr_80px_80px] items-center bg-[#F7F8F8] px-2 text-[14px] font-medium leading-5 text-[#090909]">
        <span>Route</span>
        <Link
          href={gradeHref}
          className="flex items-center"
          aria-label={
            sort === "grade:asc"
              ? "난이도 내림차순 정렬"
              : sort === "grade:desc"
                ? "정렬 해제"
                : "난이도 오름차순 정렬"
          }
        >
          Grade
          <SortIcon active={gradeSort} />
        </Link>
        <Link
          href={boulderHref}
          className="flex items-center"
          aria-label={
            sort === "boulder:asc"
              ? "볼더명 내림차순 정렬"
              : sort === "boulder:desc"
                ? "정렬 해제"
                : "볼더명 오름차순 정렬"
          }
        >
          Boulder
          <SortIcon active={boulderSort} />
        </Link>
      </div>
      <div className="border-b border-[#E8E8E8]">
        {routes.map((route) => (
          <Link
            key={route.id}
            href={`/t/${route.topoId}?route=${route.id}`}
            className="grid h-10 grid-cols-[1fr_80px_80px] items-center border-t border-[#E8E8E8] px-2 text-[14px] font-normal leading-5 text-[#2A2A2A]"
          >
            <span className="truncate pr-2">{route.name}</span>
            <span>{route.grade}</span>
            <span className="truncate">{route.boulderName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
