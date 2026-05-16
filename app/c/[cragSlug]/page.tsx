import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BoulderCard } from "@/components/public/boulder-card";
import { RouteTable } from "@/components/public/route-table";
import { TabLink } from "@/components/public/tab-link";
import { findCragBySlug } from "@/lib/db/repository";

type CragPageProps = {
  params: { cragSlug: string };
  searchParams?: { tab?: string };
};

export default function CragPage({ params, searchParams }: CragPageProps) {
  const crag = findCragBySlug(params.cragSlug);
  if (!crag) {
    notFound();
  }

  const activeTab = crag.tabs.find((tab) => tab.toLowerCase() === searchParams?.tab?.toLowerCase()) ?? "Info";

  return (
    <main className="min-h-screen bg-white pb-6">
      <AppHeader />
      <section className="relative grid h-[240px] items-end overflow-hidden bg-gradient-to-br from-[#B9A998] to-[#4B4038] p-5 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">{crag.season}</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.08em]">{crag.name}</h1>
          <p className="mt-2 max-w-[320px] text-sm font-semibold text-white/80">{crag.summary}</p>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto px-5 py-4">
        {crag.tabs.map((tab) => (
          <TabLink
            key={tab}
            href={`/c/${crag.slug}?tab=${tab.toLowerCase()}`}
            label={tab}
            active={tab === activeTab}
          />
        ))}
      </nav>

      <section className="space-y-5 px-5">
        {activeTab === "Info" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Sectors" value={crag.stats.sectors} />
              <Metric label="Boulders" value={crag.stats.boulders} />
              <Metric label="Routes" value={crag.stats.routes} />
            </div>
            <InfoBlock title="접근" body={crag.accessDesc} />
            <InfoBlock title="주차" body={crag.parkingDesc} />
          </div>
        ) : null}

        {activeTab === "Sector" ? (
          <div className="space-y-3">
            {crag.sectors.map((sector) => (
              <a key={sector.id} href={`/c/${crag.slug}/s/${sector.slug}`} className="block rounded-[24px] bg-[#F7F8F8] p-4">
                <h2 className="text-lg font-black">{sector.name}</h2>
                <p className="mt-1 text-sm font-semibold text-[#6F7477]">{sector.summary}</p>
              </a>
            ))}
          </div>
        ) : null}

        {activeTab === "Boulder" ? (
          <div className="space-y-4">
            {crag.boulders.map((boulder) => (
              <BoulderCard key={boulder.id} boulder={boulder} href={`/c/${crag.slug}/b/${boulder.id}`} />
            ))}
          </div>
        ) : null}

        {activeTab === "Route" ? <RouteTable routes={crag.routes} /> : null}

        {activeTab === "Map" ? (
          <div className="grid min-h-[360px] place-items-center rounded-[28px] bg-[#F7F8F8] p-5 text-center">
            <div>
              <p className="text-lg font-black">Kakao Map</p>
              <p className="mt-2 text-sm font-semibold text-[#6F7477]">
                {crag.boulders.length}개 Boulder 마커를 표시할 영역입니다.
              </p>
            </div>
          </div>
        ) : null}

        {activeTab === "Travel" ? <InfoBlock title="Travel" body="교통/여행 정보 게시물은 공지 관리에서 확장합니다." /> : null}
      </section>
      <BottomNav />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] bg-[#F7F8F8] p-4 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[11px] font-bold text-[#6F7477]">{label}</p>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[24px] bg-[#F7F8F8] p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#6F7477]">{body}</p>
    </article>
  );
}
