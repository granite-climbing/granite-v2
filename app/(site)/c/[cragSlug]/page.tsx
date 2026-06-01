import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { KakaoMap } from "@/components/public/kakao-map";
import { SearchField } from "@/components/public/search-field";
import { findCragBySlug } from "@/lib/db/repository";
import type { CragDetail, RouteListItem, TabName } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Allowed grade sort values for the Route tab. "" means "no sort, repo order".
type GradeSort = "grade:asc" | "grade:desc" | "";

function parseGradeSort(raw: string | undefined): GradeSort {
  return raw === "grade:asc" || raw === "grade:desc" ? raw : "";
}

type CragPageProps = {
  params: Promise<{ cragSlug: string }>;
  searchParams?: Promise<{ tab?: string; q?: string; sort?: string }>;
};

export default async function CragPage({ params, searchParams }: CragPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const crag = await findCragBySlug(resolvedParams.cragSlug);
  if (!crag) {
    notFound();
  }

  const activeTab =
    crag.tabs.find(
      (tab) => tab.toLowerCase() === resolvedSearchParams?.tab?.toLowerCase()
    ) ?? "Info";

  const query = resolvedSearchParams?.q?.trim() ?? "";
  const sort = parseGradeSort(resolvedSearchParams?.sort);
  const basePath = `/c/${crag.slug}`;

  return (
    <main className="min-h-screen bg-white pb-10 text-[#090909]">
      <AppHeader />
      <CragHero crag={crag} />
      <CragTabs crag={crag} activeTab={activeTab} query={query} sort={sort} />
      <CragTabPanel crag={crag} activeTab={activeTab} query={query} sort={sort} basePath={basePath} />
    </main>
  );
}

function CragHero({ crag }: { crag: CragDetail }) {
  return (
    <section
      className="relative flex h-[240px] items-center justify-center overflow-hidden bg-cover bg-center px-4 text-center text-white"
      style={{ backgroundImage: `url("${crag.coverImageUrl}")` }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative max-w-[328px]">
        <h1 className="text-[28px] font-extrabold leading-9">{crag.name}</h1>
        <p className="mt-4 text-[12px] font-normal leading-4 text-white">{crag.description}</p>
      </div>
    </section>
  );
}

function CragTabs({
  crag,
  activeTab,
  query,
  sort,
}: {
  crag: CragDetail;
  activeTab: TabName;
  query: string;
  sort: GradeSort;
}) {
  return (
    <nav className="flex h-14 justify-center gap-4 pt-3" aria-label="Crag 상세 탭">
      {crag.tabs.map((tab) => {
        const active = tab === activeTab;
        const tabLower = tab.toLowerCase();
        // Preserve ?q= when switching between search-bearing tabs.
        // Preserve ?sort= only when navigating to/staying on the Route tab.
        const params = new URLSearchParams({ tab: tabLower });
        if (query && ["Sector", "Boulder", "Route"].includes(tab)) {
          params.set("q", query);
        }
        if (sort && tab === "Route") {
          params.set("sort", sort);
        }
        const href = `/c/${crag.slug}?${params.toString()}`;
        return (
          <Link
            key={tab}
            href={href}
            className={`relative flex h-8 shrink-0 items-center text-[14px] leading-5 ${
              active ? "font-medium text-[#090909]" : "font-normal text-[#7A7A7A]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab}
            {active ? (
              <span className="absolute bottom-0 left-0 h-px w-full bg-[#090909]" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function CragTabPanel({
  crag,
  activeTab,
  query,
  sort,
  basePath,
}: {
  crag: CragDetail;
  activeTab: TabName;
  query: string;
  sort: GradeSort;
  basePath: string;
}) {
  if (activeTab === "Info") {
    return <InfoPanel crag={crag} />;
  }

  if (activeTab === "Sector") {
    const filtered = query
      ? crag.sectors.filter((s) => {
          const q = query.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            (s.nameEn?.toLowerCase().includes(q) ?? false)
          );
        })
      : crag.sectors;

    return (
      <section className="pt-4">
        <SectionHeading />
        <div className="mt-4">
          <SearchField
            defaultValue={query || undefined}
            placeholder="섹터 이름 검색"
            action={basePath}
            hiddenFields={{ tab: "sector" }}
          />
        </div>
        <div className="mt-4 space-y-4 px-4">
          {filtered.length === 0 ? (
            <EmptyResult query={query} />
          ) : (
            filtered.map((sector) => (
              <SectorCard key={sector.id} sector={sector} />
            ))
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "Boulder") {
    const filtered = query
      ? crag.boulders.filter((b) => {
          const q = query.toLowerCase();
          return b.name.toLowerCase().includes(q);
        })
      : crag.boulders;

    return (
      <section className="pt-4">
        <SectionHeading />
        <div className="mt-4">
          <SearchField
            defaultValue={query || undefined}
            placeholder="볼더 이름 검색"
            action={basePath}
            hiddenFields={{ tab: "boulder" }}
          />
        </div>
        <div className="mt-4 space-y-3 px-4">
          {filtered.length === 0 ? (
            <EmptyResult query={query} />
          ) : (
            filtered.map((boulder) => (
              <BoulderListCard key={boulder.id} boulder={boulder} />
            ))
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "Route") {
    // 1. Filter by search query
    const filtered = query
      ? crag.routes.filter((r) => {
          const q = query.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) ||
            r.boulderName.toLowerCase().includes(q) ||
            r.grade.toLowerCase().includes(q)
          );
        })
      : crag.routes;

    // 2. Sort after filtering
    const sorted = sort === "grade:asc"
      ? [...filtered].sort((a, b) => a.gradeNum - b.gradeNum || a.grade.localeCompare(b.grade))
      : sort === "grade:desc"
        ? [...filtered].sort((a, b) => b.gradeNum - a.gradeNum || b.grade.localeCompare(a.grade))
        : filtered;

    return (
      <section className="pt-4">
        <SectionHeading />
        <div className="mt-4">
          <SearchField
            defaultValue={query || undefined}
            placeholder="루트 이름 검색, 난이도 검색"
            action={basePath}
            hiddenFields={{ tab: "route" }}
          />
        </div>
        <div className="mt-4 px-4">
          {sorted.length === 0 ? (
            <EmptyResult query={query} />
          ) : (
            <RouteTable routes={sorted} sort={sort} query={query} basePath={basePath} />
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "Map") {
    return (
      <section className="px-4 pt-2">
        {crag.lat !== null && crag.lng !== null ? (
          <KakaoMap
            lat={crag.lat}
            lng={crag.lng}
            name={crag.name}
            className="h-[240px] w-full overflow-hidden rounded-lg md:h-[400px]"
          />
        ) : (
          <div className="flex h-[240px] items-center justify-center rounded-lg bg-[#F7F8F8] text-[14px] font-normal leading-5 text-[#7A7A7A] md:h-[400px]">
            위치 정보가 등록되지 않았습니다.
          </div>
        )}
      </section>
    );
  }

  return <TravelPanel crag={crag} />;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Info tab
// ---------------------------------------------------------------------------

function InfoPanel({ crag }: { crag: CragDetail }) {
  return (
    <>
      {/* Stats + grade distribution card */}
      <section className="px-4 pt-4">
        <div className="rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]">
          <p className="pt-6 text-center text-[14px] font-medium leading-5 text-[#2A2A2A]">
            {crag.stats.sectors} Sectors · {crag.stats.boulders} boulders ·{" "}
            {crag.stats.routes} problems
          </p>
          <GradeHistogram crag={crag} />
        </div>
      </section>

      {/* Map + info rows */}
      <section className="space-y-5 px-4 pt-8">
        <MapPreview crag={crag} />
        <InfoRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
          }
          title="Address"
          body={crag.description}
        />
        <InfoRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
              />
            </svg>
          }
          title="How to get there?"
          body={crag.description}
        />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <PillButton icon="P" label="Parking Spot" />
          <PillButton icon="☕" label="Cafe" />
        </div>
      </section>
    </>
  );
}

function GradeHistogram({ crag }: { crag: CragDetail }) {
  // Simple placeholder bars using route count data
  // In a real implementation this would use crag.stats.gradeDistribution
  const bars = [5, 12, 20, 24, 16, 2, 0, 0, 0, 0, 0, 0];
  const gradeLabels = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11+"];
  const maxBar = Math.max(...bars, 1);

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="flex items-end gap-[2px]">
        {bars.map((h, i) => (
          <div key={gradeLabels[i]} className="flex flex-1 flex-col items-center gap-[2px]">
            {h > 0 ? (
              <span className="text-[8px] font-normal leading-3 text-[#7A7A7A]">{h}</span>
            ) : (
              <span className="text-[8px] leading-3">&nbsp;</span>
            )}
            <div
              className="w-full rounded-[2px] bg-[#7A7A7A]"
              style={{ height: `${Math.max(2, Math.round((h / maxBar) * 48))}px` }}
            />
            <span className="text-[8px] font-normal leading-3 text-[#3A3A3A]">
              {gradeLabels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector tab card
// ---------------------------------------------------------------------------

function SectorCard({
  sector,
}: {
  sector: CragDetail["sectors"][number];
}) {
  return (
    <article className="overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]">
      {/* Cover image */}
      <div
        className="h-[140px] w-full bg-[#BABABA] bg-cover bg-center"
        style={sector.coverImageUrl ? { backgroundImage: `url("${sector.coverImageUrl}")` } : undefined}
      />
      {/* Info */}
      <div className="px-4 pb-4 pt-3">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">{sector.name}</h2>
        <p className="mt-1 text-[12px] font-medium leading-4 text-[#7A7A7A]">
          {sector.season} · {sector.description}
        </p>
        {/* Grade histogram placeholder */}
        <div className="mt-3 flex items-end gap-[4px]">
          {[5, 12, 20, 24, 15, 12, 5].map((h, i) => (
            <div
              key={i}
              className="rounded-[2px] bg-[#7A7A7A]"
              style={{ width: "8px", height: `${h}px` }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Boulder tab card (horizontal, Figma 30:2155 style)
// ---------------------------------------------------------------------------

function BoulderListCard({
  boulder,
}: {
  boulder: CragDetail["boulders"][number];
}) {
  return (
    <article className="flex h-[100px] overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]">
      {/* Thumbnail */}
      <div
        className="size-[84px] shrink-0 self-center rounded-[4px] bg-[#D9D9D9] bg-cover bg-center ml-2"
        style={
          boulder.coverImageUrl
            ? { backgroundImage: `url("${boulder.coverImageUrl}")` }
            : undefined
        }
      />
      {/* Content */}
      <div className="flex flex-1 flex-col justify-center pl-3 pr-2">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">{boulder.name}</h2>
        <p className="mt-[2px] text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
          {boulder.routeCount} Routes
        </p>
        {/* Grade histogram bars */}
        <div className="mt-2 flex items-end gap-[4px]">
          {[5, 12, 20, 24, 15, 12, 5].map((h, i) => (
            <div
              key={i}
              className="rounded-[2px] bg-[#7A7A7A]"
              style={{ width: "8px", height: `${h}px` }}
            />
          ))}
        </div>
      </div>
      {/* Arrow */}
      <div className="flex shrink-0 items-center pr-2">
        <span className="text-[18px] leading-none text-[#7A7A7A]">›</span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Route tab table
// ---------------------------------------------------------------------------

/** Compute the next ?sort value and full href when the Grade header is clicked. */
function nextGradeSortHref(currentSort: string, basePath: string, query: string): string {
  let nextSort: string;
  if (currentSort === "grade:asc") {
    nextSort = "grade:desc";
  } else if (currentSort === "grade:desc") {
    nextSort = "";
  } else {
    nextSort = "grade:asc";
  }
  const params = new URLSearchParams({ tab: "route" });
  if (query) params.set("q", query);
  if (nextSort) params.set("sort", nextSort);
  return `${basePath}?${params.toString()}`;
}

function GradeSortIcon({ sort }: { sort: GradeSort }) {
  if (sort === "grade:asc") {
    // Filled up-arrow
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
  if (sort === "grade:desc") {
    // Filled down-arrow
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
  // Neutral up/down chevron pair (subtle)
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
  basePath,
}: {
  routes: RouteListItem[];
  sort: GradeSort;
  query: string;
  basePath: string;
}) {
  if (routes.length === 0) return null;
  const gradeHref = nextGradeSortHref(sort, basePath, query);
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
          <GradeSortIcon sort={sort} />
        </Link>
        <span>Boulder</span>
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

// ---------------------------------------------------------------------------
// Map preview (placeholder)
// ---------------------------------------------------------------------------

function MapPreview({
  crag,
  variant = "default",
}: {
  crag: CragDetail;
  variant?: "default" | "large";
}) {
  const heightClass = variant === "large" ? "h-[400px]" : "h-[216px]";

  return (
    <div
      className={`relative grid ${heightClass} place-items-center overflow-hidden rounded-[8px] bg-[#E7F1E7]`}
    >
      <div className="absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(34deg,transparent_0,transparent_14px,rgba(122,122,122,0.16)_15px,transparent_16px)]" />
      <div className="absolute left-[112px] top-[-24px] h-[480px] w-[24px] rotate-[-24deg] rounded-full bg-white" />
      <div className="absolute left-[146px] top-[-24px] h-[480px] w-[14px] rotate-[-24deg] rounded-full bg-[#99C9D8]" />
      <div className="absolute left-[166px] top-[26px] flex flex-col gap-2">
        {crag.boulders.slice(0, 5).map((boulder) => (
          <span
            key={boulder.id}
            className="grid size-3 place-items-center rounded-full bg-[#EA6AD9] text-[8px] leading-none text-white"
          >
            ★
          </span>
        ))}
      </div>
      <div className="relative text-center">
        <p className="text-[20px] font-bold leading-7 text-[#2A2A2A]">카카오맵 연동</p>
        {crag.lat && crag.lng ? (
          <p className="mt-1 text-[12px] font-normal leading-4 text-[#7A7A7A]">
            {crag.lat.toFixed(4)}, {crag.lng.toFixed(4)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Travel tab
// ---------------------------------------------------------------------------

function TravelPanel({ crag }: { crag: CragDetail }) {
  const items = buildTravelItems(crag);

  return (
    <section className="px-4 pt-2">
      <div className="border-t border-[#E8E8E8]">
        {items.map((item) => (
          <article
            key={item.id}
            className="grid h-[138px] grid-cols-[1fr_88px] gap-4 border-b border-[#E8E8E8] py-4"
          >
            <div>
              <h2 className="line-clamp-2 text-[18px] font-medium leading-6 text-[#090909]">
                {item.title}
              </h2>
              <p className="mt-[6px] line-clamp-2 text-[12px] font-normal leading-4 text-[#7A7A7A]">
                {item.body}
              </p>
              <p className="mt-2 text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
                {item.date}
              </p>
            </div>
            <div
              className="size-[88px] rounded-[8px] bg-[#BABABA] bg-cover bg-center"
              style={{ backgroundImage: `url("${item.imageUrl}")` }}
            />
          </article>
        ))}
      </div>
      <div className="mt-[30px] flex items-center justify-center gap-6 text-[12px] font-normal leading-4">
        <span className="text-[#090909]">‹</span>
        {[1, 2, 3, 4, 5].map((page) => (
          <span key={page} className={page === 1 ? "text-[#090909]" : "text-[#B8B8B8]"}>
            {page}
          </span>
        ))}
        <span className="text-[#090909]">›</span>
      </div>
    </section>
  );
}

function buildTravelItems(crag: CragDetail) {
  const baseItems = [
    { id: "access", title: `${crag.name} 접근 안내`, body: crag.description },
    { id: "season", title: `${crag.name} 시즌과 컨디션`, body: crag.season },
    {
      id: "sector",
      title: "추천 섹터와 동선",
      body: crag.sectors.map((sector) => sector.name).join(", "),
    },
    {
      id: "boulder",
      title: "대표 볼더 체크리스트",
      body: crag.boulders.map((boulder) => boulder.name).join(", "),
    },
  ];

  return baseItems.map((item) => ({
    ...item,
    date: "2023.08.25",
    imageUrl: crag.coverImageUrl,
  }));
}

// ---------------------------------------------------------------------------
// Shared utility components
// ---------------------------------------------------------------------------

function InfoRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center text-[#090909]">
        {icon}
      </span>
      <div>
        <h2 className="text-[14px] font-medium leading-5 text-[#090909]">{title}</h2>
        <p className="mt-[2px] text-[14px] font-normal leading-5 text-[#2A2A2A]">{body}</p>
      </div>
    </div>
  );
}

function PillButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-[#E8E8E8] text-[14px] font-medium leading-5 text-[#3A3A3A]"
    >
      <span className="text-[13px]">{icon}</span>
      {label}
    </button>
  );
}
