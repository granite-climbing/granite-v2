import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AdSlot } from "@/components/public/ad-slot";
import { CragCard } from "@/components/public/crag-card";
import { StatBar } from "@/components/public/stat-bar";
import { getHomeModel } from "@/lib/db/repository";

export default function HomePage() {
  const model = getHomeModel();
  const selectedArea = model.areas[0];

  return (
    <main className="min-h-screen bg-white pb-6">
      <AppHeader />
      <section className="mx-5 mt-5 overflow-hidden rounded-[32px] bg-[#1A1A1A] p-6 text-white">
        <p className="text-sm font-bold text-[#C9C1B6]">DREAM to DREAM!</p>
        <h1 className="mt-8 text-4xl font-black tracking-[-0.08em]">Find your next dream.</h1>
        <p className="mt-4 text-sm font-semibold text-white/70">
          {model.totals.crags} CRAGS · {model.totals.boulders} BOULDERS · {model.totals.routes} ROUTES
        </p>
      </section>

      <section className="px-5 pt-7">
        <h2 className="text-2xl font-black tracking-[-0.06em]">FIND YOUR NEXT DREAM!</h2>
        <label className="mt-4 block">
          <span className="sr-only">통합 검색</span>
          <input
            className="h-12 w-full rounded-full border border-[#E8E8E8] bg-[#F7F8F8] px-5 text-sm font-semibold outline-none"
            placeholder="문제, 볼더, 섹터, 암장, 난이도 검색"
          />
        </label>
      </section>

      <AdSlot />

      <section className="px-5">
        <div className="flex gap-2 overflow-x-auto pb-3">
          {model.areas.map((area) => (
            <span
              key={area.id}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                area.id === selectedArea?.id ? "bg-[#1A1A1A] text-white" : "bg-[#F1F1EF] text-[#6F7477]"
              }`}
            >
              {area.name}
            </span>
          ))}
        </div>

        {selectedArea ? (
          <div className="rounded-[28px] bg-[#F7F8F8] p-5">
            <p className="text-sm font-bold text-[#6F7477]">Selected Area</p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.06em]">{selectedArea.name}</h2>
            <p className="mt-2 text-sm font-semibold text-[#6F7477]">
              {selectedArea.stats.crags} Crags · {selectedArea.stats.sectors} Sectors ·{" "}
              {selectedArea.stats.boulders} Boulders · {selectedArea.stats.routes} Routes
            </p>
            <div className="mt-4">
              <StatBar />
            </div>
          </div>
        ) : null}
      </section>

      <section className="pt-8">
        <div className="mb-4 flex items-center justify-between px-5">
          <h2 className="text-2xl font-black tracking-[-0.06em]">Crags</h2>
          <span className="text-sm font-black">All →</span>
        </div>
        <div className="flex gap-4 overflow-x-auto px-5 pb-2">
          {selectedArea?.crags.map((crag) => <CragCard key={crag.id} crag={crag} />)}
        </div>
      </section>

      <AdSlot />

      <section className="px-5">
        <h2 className="mb-4 text-2xl font-black tracking-[-0.06em]">New Updates</h2>
        <div className="space-y-3">
          {model.announcements.map((announcement) => (
            <a key={announcement.id} href={announcement.linkUrl} className="block rounded-[24px] bg-[#F7F8F8] p-4">
              <p className="text-sm font-black">{announcement.title}</p>
              <p className="mt-1 text-xs font-semibold text-[#6F7477]">{announcement.body}</p>
            </a>
          ))}
        </div>
      </section>

      <AdSlot />
      <BottomNav />
    </main>
  );
}
