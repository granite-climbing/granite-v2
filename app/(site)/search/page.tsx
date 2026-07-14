import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";
import { AppHeader } from "@/components/layout/app-header";
import { SearchField } from "@/components/public/search-field";
import { searchPublicContent } from "@/lib/db/repository";
import type {
  Area,
  Crag,
  RouteListItem,
  SearchBoulderResult,
  SearchResults,
  SearchSectorResult,
  Stats,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "검색 · Granite",
  description: "Area, Crag, Sector, Boulder, Route 통합 검색",
};

type SearchPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q?.trim() ?? "";
  const results = await searchPublicContent(query);
  const totalCount =
    results.areas.length +
    results.crags.length +
    results.sectors.length +
    results.boulders.length +
    results.routes.length;

  return (
    <main className="min-h-screen bg-white pb-10 text-[#090909]">
      <AppHeader />

      <section className="pt-5">
        <SearchField
          action="/search"
          defaultValue={query}
          placeholder="문제, 볼더, 섹터, 암장, 난이도 검색"
          behavior="debounced"
        />
      </section>

      <section className="px-4 pt-6">
        <h1 className="text-[20px] font-bold leading-7">Search</h1>
        {query ? (
          <p className="mt-1 text-[13px] font-medium leading-5 text-[#7A7A7A]">
            "{query}" 검색 결과 {totalCount}개
          </p>
        ) : (
          <p className="mt-1 text-[13px] font-medium leading-5 text-[#7A7A7A]">
            Area, Crag, Sector, Boulder, Route를 한 번에 검색할 수 있습니다.
          </p>
        )}
      </section>

      {query ? <SearchResultSections results={results} /> : null}

      {query && totalCount === 0 ? (
        <p className="px-4 py-12 text-center text-[14px] font-medium leading-5 text-[#7A7A7A]">
          검색 결과가 없습니다.
        </p>
      ) : null}
    </main>
  );
}

function SearchResultSections({ results }: { results: SearchResults }) {
  return (
    <div className="space-y-8 pt-6">
      <ResultSection title="Area" count={results.areas.length}>
        {results.areas.map((area) => (
          <AreaResultCard key={area.id} area={area} />
        ))}
      </ResultSection>
      <ResultSection title="Crag" count={results.crags.length}>
        {results.crags.map((crag) => (
          <CragResultCard key={crag.id} crag={crag} />
        ))}
      </ResultSection>
      <ResultSection title="Sector" count={results.sectors.length}>
        {results.sectors.map((sector) => (
          <SectorResultCard key={sector.id} sector={sector} />
        ))}
      </ResultSection>
      <ResultSection title="Boulder" count={results.boulders.length}>
        {results.boulders.map((boulder) => (
          <BoulderResultCard key={boulder.id} boulder={boulder} />
        ))}
      </ResultSection>
      <ResultSection title="Route" count={results.routes.length}>
        {results.routes.map((route) => (
          <RouteResultCard key={route.id} route={route} />
        ))}
      </ResultSection>
    </div>
  );
}

function ResultSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="px-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">{title}</h2>
        <span className="text-[12px] font-medium leading-4 text-[#7A7A7A]">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function AreaResultCard({ area }: { area: Area & { stats: Stats } }) {
  return (
    <SearchListCard
      href={`/a/${area.slug}`}
      title={area.name}
      eyebrow="Area"
      meta={`${area.stats.crags} Crags · ${area.stats.sectors} Sectors · ${area.stats.boulders} Boulders · ${area.stats.routes} Routes`}
      imageUrl={area.coverImageUrl}
    />
  );
}

function CragResultCard({
  crag,
}: {
  crag: Crag & { stats: Omit<Stats, "crags"> };
}) {
  return (
    <SearchListCard
      href={`/c/${crag.slug}`}
      title={crag.name}
      eyebrow="Crag"
      meta={`${crag.stats.sectors} Sectors · ${crag.stats.boulders} Boulders · ${crag.stats.routes} Routes`}
      imageUrl={crag.coverImageUrl}
    />
  );
}

function SectorResultCard({ sector }: { sector: SearchSectorResult }) {
  return (
    <SearchListCard
      href={`/c/${sector.cragSlug}?tab=sector#sector-card-${sector.id}`}
      title={sector.name}
      eyebrow={sector.cragName}
      meta={`${sector.boulderCount} Boulders · ${sector.routeCount} Routes`}
      imageUrl={sector.coverImageUrl}
    />
  );
}

function BoulderResultCard({ boulder }: { boulder: SearchBoulderResult }) {
  return (
    <SearchListCard
      href={`/c/${boulder.cragSlug}?tab=route&boulderId=${encodeURIComponent(boulder.id)}`}
      title={boulder.name}
      eyebrow={`${boulder.cragName} · ${boulder.sectorName}`}
      meta={`${boulder.routeCount} Routes · ${boulder.gradeRange}`}
      imageUrl={boulder.coverImageUrl}
    />
  );
}

function RouteResultCard({ route }: { route: RouteListItem }) {
  return (
    <SearchListCard
      href={`/t/${route.topoId}?route=${route.id}`}
      title={route.name}
      eyebrow={`${route.cragName} · ${route.sectorName} · ${route.boulderName}`}
      meta={route.grade}
      imageUrl={route.lineImageUrl !== '' ? route.lineImageUrl : route.topoBaseImageUrl ?? ''}
    />
  );
}

function SearchListCard({
  href,
  title,
  eyebrow,
  meta,
  imageUrl,
}: {
  href: string;
  title: string;
  eyebrow: string;
  meta: string;
  imageUrl: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-[100px] items-center overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]"
    >
      <div
        className="ml-2 size-[84px] shrink-0 self-center rounded-[4px] bg-[#D9D9D9] bg-cover bg-center"
        style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
      />
      <div className="min-w-0 flex-1 pl-3 pr-2">
        <p className="truncate text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
          {eyebrow}
        </p>
        <h3 className="mt-[2px] truncate text-[16px] font-bold leading-6 text-[#090909]">
          {title}
        </h3>
        <p className="mt-[2px] truncate text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
          {meta}
        </p>
      </div>
      <div className="flex shrink-0 items-center pr-2">
        <span className="text-[18px] leading-none text-[#7A7A7A]">›</span>
      </div>
    </Link>
  );
}
