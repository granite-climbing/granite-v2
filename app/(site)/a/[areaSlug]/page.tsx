import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AreaCragCard } from "@/components/public/area-crag-card";
import { AreaOverviewMap } from "@/components/public/area-overview-map";
import { findAreaDetailBySlug, getPublishedAreasList } from "@/lib/db/repository";

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

  const [area, allAreas] = await Promise.all([
    findAreaDetailBySlug(areaSlug),
    getPublishedAreasList(),
  ]);
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
    <main className="min-h-screen bg-[#121212] pb-10">
      <AppHeader />

      {/* Full-bleed overview map (square, per Figma `area` frame) */}
      {area.cragLocations.length > 0 ? (
        <AreaOverviewMap markers={area.cragLocations} className="aspect-square w-full" />
      ) : (
        <div className="grid aspect-square w-full place-items-center bg-[#D9D9D9]">
          <p className="text-[14px] font-medium leading-5 text-black">지도</p>
        </div>
      )}

      {/* Region chips */}
      <nav
        className="no-scrollbar flex gap-[6px] overflow-x-auto px-4 pt-3"
        aria-label="지역 선택"
      >
        <RegionChip href="/" label="전체" active={false} />
        {allAreas.map((a) => (
          <RegionChip
            key={a.id}
            href={`/a/${a.slug}`}
            label={a.name}
            active={a.id === area.id}
          />
        ))}
      </nav>

      {/* Search */}
      <section className="px-4 pt-3">
        <form method="get" action={`/a/${area.slug}`}>
          <label className="relative block">
            <span className="sr-only">Crag 검색</span>
            <input
              name="q"
              defaultValue={q}
              className="h-12 w-full rounded-full border-0 bg-[#2A2A2A] px-4 pr-12 text-[14px] font-medium leading-5 text-white outline-none placeholder:text-[#7A7A7A]"
              placeholder="Crag 이름 검색"
            />
            <button
              type="submit"
              className="absolute right-4 top-3 text-[18px] leading-6 text-white"
              aria-label="검색"
            >
              ⌕
            </button>
          </label>
        </form>
      </section>

      {/* Crag list */}
      <section className="mt-3 space-y-3 px-4">
        {filteredCrags.length > 0 ? (
          filteredCrags.map((crag) => (
            <div key={crag.id} id={`crag-card-${crag.id}`} className="rounded-[8px]">
              <AreaCragCard crag={crag} />
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

function RegionChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-[6px] text-center text-[14px] leading-5 ${
        active
          ? "bg-white font-medium text-[#090909]"
          : "bg-[#2A2A2A] font-normal text-white"
      }`}
    >
      {label}
    </Link>
  );
}
