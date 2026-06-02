import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AreaOverviewMap } from "@/components/public/area-overview-map";
import { CragCard } from "@/components/public/crag-card";
import { StatBar } from "@/components/public/stat-bar";
import { findAreaDetailBySlug } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AreaPageProps = {
  params: Promise<{ areaSlug: string }>;
  searchParams?: Promise<{ q?: string }>;
};

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: AreaPageProps): Promise<Metadata> {
  const { areaSlug } = await params;
  const area = await findAreaDetailBySlug(areaSlug);

  if (!area) {
    return { title: "Area · Granite" };
  }

  return {
    title: `${area.name} · Granite`,
    description: area.nameEn
      ? `${area.name} (${area.nameEn}) — 볼더링 스팟 탐색`
      : `${area.name} — 볼더링 스팟 탐색`
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AreaPage({ params, searchParams }: AreaPageProps) {
  const { areaSlug } = await params;
  const resolvedSearch = await searchParams;
  const q = resolvedSearch?.q?.trim() ?? "";

  const area = await findAreaDetailBySlug(areaSlug);
  if (!area) {
    notFound();
  }

  // Server-side case-insensitive substring filter on crag name / name_en
  const filteredCrags = q
    ? area.crags.filter((crag) => {
        const needle = q.toLowerCase();
        return (
          crag.name.toLowerCase().includes(needle) ||
          (crag.nameEn?.toLowerCase().includes(needle) ?? false)
        );
      })
    : area.crags;

  return (
    <main className="min-h-screen bg-white pb-10 text-[#090909]">
      <AppHeader />

      {/* Hero */}
      <section
        className="relative flex h-[200px] items-end overflow-hidden bg-cover bg-center px-4 pb-4 text-white"
        style={area.coverImageUrl ? { backgroundImage: `url("${area.coverImageUrl}")` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
        <div className="relative">
          <h1 className="text-[24px] font-extrabold leading-8">{area.name}</h1>
          {area.nameEn ? (
            <p className="text-[13px] font-medium leading-5 text-white/80">{area.nameEn}</p>
          ) : null}
        </div>
      </section>

      {/* Aggregate stats */}
      <section className="grid h-[56px] place-items-center bg-[#F7F8F8]">
        <p className="text-center text-[13px] font-medium leading-5 text-[#2A2A2A]">
          {area.stats.crags} Crags · {area.stats.sectors} Sectors · {area.stats.boulders} Boulders ·{" "}
          {area.stats.routes} Routes
        </p>
      </section>

      {/* Grade distribution */}
      <section className="px-4 pt-5">
        <StatBar gradeDistribution={area.gradeDistribution} variant="full" />
      </section>

      {/* Search */}
      <section className="px-4 pt-5">
        <form method="get" action={`/a/${area.slug}`}>
          <label className="relative block">
            <span className="sr-only">Crag 검색</span>
            <input
              name="q"
              defaultValue={q}
              className="h-12 w-full rounded-full border-0 bg-white px-4 pr-12 text-[14px] font-medium leading-5 text-[#090909] shadow-[0_0_6px_2px_rgba(0,0,0,0.1)] outline-none placeholder:text-[#B8B8B8]"
              placeholder="Crag 이름 검색"
            />
            <button
              type="submit"
              className="absolute right-4 top-3 text-[18px] leading-6 text-[#090909]"
              aria-label="검색"
            >
              ⌕
            </button>
          </label>
        </form>
      </section>

      {/* Overview map — only rendered when at least one crag has coordinates */}
      {area.cragLocations.length > 0 ? (
        <div className="mt-6 px-4">
          <AreaOverviewMap
            markers={area.cragLocations}
            className="h-[240px] w-full overflow-hidden rounded-lg md:h-[360px]"
          />
        </div>
      ) : null}

      {/* Crag list */}
      <section className="mt-6 flex flex-col items-center gap-4 px-4">
        {filteredCrags.length > 0 ? (
          filteredCrags.map((crag) => (
            <div key={crag.id} id={`crag-card-${crag.id}`} className="rounded-lg transition-shadow">
              <CragCard crag={crag} />
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-[14px] text-[#7A7A7A]">
            {q ? `"${q}"에 해당하는 Crag가 없습니다.` : "등록된 Crag가 없습니다."}
          </p>
        )}
      </section>
    </main>
  );
}
