import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AreaCragCard } from "@/components/public/area-crag-card";
import { AreaOverviewMap } from "@/components/public/area-overview-map";
import { RegionChips } from "@/components/public/region-chips";
import { getHomeModel, getPublishedAreasList } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "전체 지역 · Granite",
  description: "전국 자연 볼더링 스팟 탐색",
};

// Fixed all-Korea view: centered between the coasts, zoomed out far enough
// that the whole peninsula is visible (Kakao level 13 ≈ nation-wide).
const KOREA_VIEW = { center: { lat: 36.2, lng: 127.9 }, zoom: 13 };

type AllAreasPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function AllAreasPage({ searchParams }: AllAreasPageProps) {
  const resolvedSearch = await searchParams;
  const q = resolvedSearch?.q?.trim() ?? "";

  const [home, allAreas] = await Promise.all([
    getHomeModel(),
    getPublishedAreasList(),
  ]);

  const markers = home.allCrags
    .filter(
      (crag): crag is typeof crag & { lat: number; lng: number } =>
        crag.lat !== null && crag.lng !== null
    )
    .map((crag) => ({ id: crag.id, lat: crag.lat, lng: crag.lng, name: crag.name }));

  const filteredCrags = q
    ? home.allCrags.filter((crag) => {
        const needle = q.toLowerCase();
        return (
          crag.name.toLowerCase().includes(needle) ||
          (crag.nameEn?.toLowerCase().includes(needle) ?? false)
        );
      })
    : home.allCrags;

  return (
    <main className="min-h-screen bg-[#121212] pb-10">
      <AppHeader />

      {/* Full-bleed map of the whole country */}
      {markers.length > 0 ? (
        <AreaOverviewMap
          markers={markers}
          fixedView={KOREA_VIEW}
          className="aspect-square w-full"
        />
      ) : (
        <div className="grid aspect-square w-full place-items-center bg-[#D9D9D9]">
          <p className="text-[14px] font-medium leading-5 text-black">지도</p>
        </div>
      )}

      {/* Region chips — 전체 active */}
      <RegionChips areas={allAreas} activeAreaId={null} />

      {/* Search */}
      <section className="px-4 pt-3">
        <form method="get" action="/a">
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

      {/* Crag list — every published crag */}
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
