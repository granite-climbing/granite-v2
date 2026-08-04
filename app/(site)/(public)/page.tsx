import { AppHeader } from "@/components/layout/app-header";
import { AdSlot } from "@/components/public/ad-slot";
import { AreaCard } from "@/components/public/area-card";
import { CragCarousel } from "@/components/public/crag-carousel";
import { DragScroller } from "@/components/public/drag-scroller";
import { SearchField } from "@/components/public/search-field";
import { getHomeModel } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const model = await getHomeModel();
  // New Updates 영역에서 사용. 추후 복원 시 함께 활성화.
  // const updates = model.announcements;

  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="relative aspect-[3/2] w-full overflow-hidden bg-[url('/images/figma/main-banner.jpg')] bg-cover bg-center text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        <div className="absolute inset-x-4 top-1/2 mx-auto max-w-[560px] -translate-y-1/2 text-center">
          <p className="text-[28px] font-extrabold leading-9">DREAM to DREAM!</p>
          <p className="mt-1 text-[14px] font-medium leading-5 text-white whitespace-nowrap">
            {model.totals.crags} CRAGS · {model.totals.boulders} BOULDERS · {model.totals.routes} ROUTES
          </p>
        </div>
      </section>

      <section className="pt-5">
        <h2 className="text-center text-[16px] font-bold leading-6 text-[#090909]">FIND YOUR NEXT DREAM!</h2>
        <div className="mt-4">
          <SearchField
            action="/search"
            placeholder="문제, 볼더, 섹터, 암장, 난이도 검색"
            behavior="focus-redirect"
          />
        </div>
      </section>

      <div className="mt-9">
        <AdSlot />
      </div>

      {/* Area slider */}
      <section className="mt-10">
        <div className="mb-5 px-4">
          <h2 className="text-[20px] font-bold leading-7 text-[#090909]">Area</h2>
        </div>
        <DragScroller className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3">
          {model.areas.map((area) => (
            <div key={area.id} className="w-[270px] shrink-0 snap-start">
              <AreaCard area={area} href={`/a/${area.slug}`} />
            </div>
          ))}
        </DragScroller>
      </section>

      <div className="mt-10">
        <AdSlot />
      </div>

      {/* All-Crags slider */}
      <section className="mt-10">
        <div className="mb-5 flex h-7 items-center justify-between px-4">
          <h2 className="text-[20px] font-bold leading-7 text-[#090909]">Crags</h2>
          <span className="flex items-center text-[14px] font-medium leading-5 text-[#7A7A7A]">All ›</span>
        </div>
        <CragCarousel crags={model.allCrags} />
      </section>

      <div className="mt-10">
        <AdSlot />
      </div>

      {/* New Updates 영역 - 추후 추가 예정이라 임시 비활성화
      <section className="mt-10">
        <div className="mb-5 px-4">
          <h2 className="text-[20px] font-bold leading-7 text-[#090909]">New Updates</h2>
        </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
          {updates.map((announcement) => (
            <a
              key={announcement.id}
              href={announcement.linkUrl}
              className="relative block aspect-[3/2] w-[270px] shrink-0 overflow-hidden rounded-[8px] bg-cover bg-center"
              style={{ backgroundImage: `url("${announcement.coverImageUrl}")` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[44%] to-black/80" />
              <div className="absolute bottom-4 left-4 w-[130px] text-white">
                <p className="text-[20px] font-bold leading-7">올산천 계곡</p>
                <p className="mt-[2px] text-[12px] font-medium leading-4">+3 Boulders · 10 Routes</p>
                <p className="mt-[6px] text-[10px] font-normal leading-[14px] opacity-60">Updated 2 weeks ago</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="border-t border-[#E8E8E8]">
          {[
            "불암산 (신규지역) 오픈",
            "수락산(기존 지역) 신규 라인 추가 업데이트",
            "모락산(신규 지역)오픈",
            "검단산 야간 볼더링 페스티벌"
          ].map((title) => (
            <a
              key={title}
              href="/"
              className="flex h-14 items-center justify-between border-b border-[#E8E8E8] text-[16px] font-normal leading-6 text-[#090909]"
            >
              <span>{title}</span>
              <span className="text-[24px] leading-6 text-[#090909]">›</span>
            </a>
          ))}
        </div>
      </section>
      */}

      <div className="mt-[66px]">
        <AdSlot />
      </div>
    </main>
  );
}
