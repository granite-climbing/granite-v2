import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { KakaoMap } from "@/components/public/kakao-map";
import { findCragBySlug } from "@/lib/db/repository";
import type { CragDetail, TabName } from "@/lib/db/schema";
import { bucketGradeNums, GRADE_LABELS } from "@/lib/grade-histogram";
import { CragSearchPanel } from "./crag-search-panel";

export const dynamic = "force-dynamic";

// Allowed grade sort values for the Route tab. "" means "no sort, repo order".
type GradeSort = "grade:asc" | "grade:desc" | "";

function parseGradeSort(raw: string | undefined): GradeSort {
  return raw === "grade:asc" || raw === "grade:desc" ? raw : "";
}

type CragPageProps = {
  params: Promise<{ cragSlug: string }>;
  searchParams?: Promise<{ tab?: string; q?: string; sort?: string; boulderId?: string }>;
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
  const boulderId = resolvedSearchParams?.boulderId?.trim() ?? "";
  const basePath = `/c/${crag.slug}`;

  return (
    <main className="min-h-screen bg-white pb-10 text-[#090909]">
      <AppHeader />
      <CragHero crag={crag} />
      <CragTabs crag={crag} activeTab={activeTab} sort={sort} boulderId={boulderId} />
      <CragTabPanel crag={crag} activeTab={activeTab} query={query} sort={sort} boulderId={boulderId} basePath={basePath} />
    </main>
  );
}

function CragHero({ crag }: { crag: CragDetail }) {
  return (
    <section
      className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-cover bg-center px-4 text-center text-white"
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
  sort,
  boulderId,
}: {
  crag: CragDetail;
  activeTab: TabName;
  sort: GradeSort;
  boulderId: string;
}) {
  return (
    <nav className="flex h-14 justify-center gap-4 pt-3" aria-label="Crag 상세 탭">
      {crag.tabs.map((tab) => {
        const active = tab === activeTab;
        const tabLower = tab.toLowerCase();
        // Preserve ?sort= and ?boulderId= only when navigating to/staying on the Route tab.
        const params = new URLSearchParams({ tab: tabLower });
        if (sort && tab === "Route") {
          params.set("sort", sort);
        }
        if (boulderId && tab === "Route") {
          params.set("boulderId", boulderId);
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
  boulderId,
  basePath,
}: {
  crag: CragDetail;
  activeTab: TabName;
  query: string;
  sort: GradeSort;
  boulderId: string;
  basePath: string;
}) {
  if (activeTab === "Info") {
    return <InfoPanel crag={crag} />;
  }

  if (activeTab === "Sector") {
    return (
      <CragSearchPanel
        crag={crag}
        activeTab={activeTab}
        initialQuery={query}
        sort={sort}
        boulderId={boulderId}
        basePath={basePath}
      />
    );
  }

  if (activeTab === "Boulder") {
    return (
      <CragSearchPanel
        crag={crag}
        activeTab={activeTab}
        initialQuery={query}
        sort={sort}
        boulderId={boulderId}
        basePath={basePath}
      />
    );
  }

  if (activeTab === "Route") {
    return (
      <CragSearchPanel
        crag={crag}
        activeTab={activeTab}
        initialQuery={query}
        sort={sort}
        boulderId={boulderId}
        basePath={basePath}
      />
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
        {crag.lat !== null && crag.lng !== null ? (
          <KakaoMap
            lat={crag.lat}
            lng={crag.lng}
            name={crag.name}
            className="h-[216px] w-full overflow-hidden rounded-[8px]"
          />
        ) : (
          <div className="flex h-[216px] items-center justify-center rounded-[8px] bg-[#F7F8F8] text-[14px] font-normal leading-5 text-[#7A7A7A]">
            위치 정보가 등록되지 않았습니다.
          </div>
        )}
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
  const bars = bucketGradeNums(crag.routes);
  const maxBar = Math.max(...bars, 1);

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="flex items-end gap-[2px]">
        {bars.map((h, i) => (
          <div key={GRADE_LABELS[i]} className="flex flex-1 flex-col items-center gap-[2px]">
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
              {GRADE_LABELS[i]}
            </span>
          </div>
        ))}
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
