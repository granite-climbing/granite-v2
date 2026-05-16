import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AdSlot } from "@/components/public/ad-slot";
import { CragCard } from "@/components/public/crag-card";
import { StatBar } from "@/components/public/stat-bar";
import { getHomeModel } from "@/lib/db/repository";

export default function HomePage() {
  const model = getHomeModel();
  const selectedArea = model.areas[0];
  const updates = model.announcements;

  return (
    <main className="min-h-screen bg-white pb-0">
      <AppHeader />
      <section className="relative mx-auto h-[200px] w-[360px] max-w-[calc(100%-32px)] overflow-hidden bg-[linear-gradient(145deg,#d9d1c4_0%,#9b8a7d_45%,#3d3936_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.35),transparent_25%),linear-gradient(to_bottom,rgba(0,0,0,0.02),rgba(0,0,0,0.55))]" />
        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-[13px] font-black tracking-[-0.03em]">DREAM to DREAM!</p>
          <p className="mt-2 text-[12px] font-bold tracking-[0.04em] text-white/80">
            {model.totals.crags} CRAGS · {model.totals.boulders} BOULDERS · {model.totals.routes} ROUTES
          </p>
        </div>
      </section>

      <section className="px-4 pt-7">
        <h2 className="text-[26px] font-black leading-[1.05] tracking-[-0.07em]">FIND YOUR NEXT DREAM!</h2>
        <label className="mt-5 block">
          <span className="sr-only">통합 검색</span>
          <input
            className="h-12 w-full rounded-[12px] border border-[#E8E8E8] bg-white px-4 text-[13px] font-semibold shadow-[0_6px_18px_rgba(26,26,26,0.06)] outline-none placeholder:text-[#A3A6A8]"
            placeholder="문제, 볼더, 섹터, 암장, 난이도 검색"
          />
        </label>
      </section>

      <AdSlot />

      <section className="px-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-4">
          {model.areas.map((area) => (
            <span
              key={area.id}
              className={`shrink-0 rounded-full px-[18px] py-[9px] text-[14px] font-black ${
                area.id === selectedArea?.id ? "bg-[#1A1A1A] text-white" : "bg-[#F7F8F8] text-[#82878A]"
              }`}
            >
              {area.name}
            </span>
          ))}
        </div>

        {selectedArea ? (
          <div className="rounded-[8px] bg-[#F7F8F8] p-4">
            <h2 className="text-[24px] font-black tracking-[-0.06em]">{selectedArea.name}</h2>
            <p className="mt-2 text-[12px] font-bold text-[#6F7477]">
              {selectedArea.stats.crags} Crags · {selectedArea.stats.sectors} Sectors ·{" "}
              {selectedArea.stats.boulders} Boulders · {selectedArea.stats.routes} Routes
            </p>
            <div className="mt-5">
              <StatBar />
            </div>
          </div>
        ) : null}
      </section>

      <section className="pt-7">
        <div className="mb-4 flex items-center justify-between px-4">
          <h2 className="text-[24px] font-black tracking-[-0.06em]">Crags</h2>
          <span className="text-[13px] font-black">All →</span>
        </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-3">
          {selectedArea?.crags.map((crag) => <CragCard key={crag.id} crag={crag} />)}
        </div>
        <div className="mt-1 flex justify-center gap-[6px]">
          <span className="size-[6px] rounded-full bg-[#1A1A1A]" />
          <span className="size-[6px] rounded-full bg-[#D9D9D9]" />
          <span className="size-[6px] rounded-full bg-[#D9D9D9]" />
        </div>
      </section>

      <AdSlot />

      <section>
        <div className="mb-4 flex items-center justify-between px-4">
          <h2 className="text-[24px] font-black tracking-[-0.06em]">New Updates</h2>
          <span className="text-[13px] font-black">All →</span>
        </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
          {updates.map((announcement) => (
            <a key={announcement.id} href={announcement.linkUrl} className="block w-[270px] shrink-0">
              <div className="h-[152px] rounded-[8px] bg-[linear-gradient(135deg,#ded7cd,#8d7d70)]" />
              <p className="mt-3 text-[15px] font-black leading-tight">{announcement.title}</p>
              <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-[#6F7477]">{announcement.body}</p>
            </a>
          ))}
        </div>
      </section>

      <AdSlot />
      <section className="px-4 pb-8">
        <div className="space-y-1">
          {updates.map((announcement) => (
            <a
              key={`list-${announcement.id}`}
              href={announcement.linkUrl}
              className="flex min-h-12 items-center justify-between border-b border-[#E8E8E8] text-[14px] font-bold"
            >
              <span>{announcement.title}</span>
              <span className="text-xl text-[#8B8F91]">›</span>
            </a>
          ))}
        </div>
      </section>
      <AdSlot />
      <BottomNav />
    </main>
  );
}
