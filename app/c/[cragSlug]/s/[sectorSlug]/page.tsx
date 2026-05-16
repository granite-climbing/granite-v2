import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BoulderCard } from "@/components/public/boulder-card";
import { RouteTable } from "@/components/public/route-table";
import { TabLink } from "@/components/public/tab-link";
import { findSectorBySlug } from "@/lib/db/repository";

type SectorPageProps = {
  params: { cragSlug: string; sectorSlug: string };
  searchParams?: { tab?: string };
};

export default function SectorPage({ params, searchParams }: SectorPageProps) {
  const sector = findSectorBySlug(params.cragSlug, params.sectorSlug);
  if (!sector) {
    notFound();
  }

  const activeTab = sector.tabs.find((tab) => tab.toLowerCase() === searchParams?.tab?.toLowerCase()) ?? "Info";

  return (
    <main className="min-h-screen bg-white pb-6">
      <AppHeader />
      <section className="grid h-[240px] items-end bg-gradient-to-br from-[#B9A998] to-[#4B4038] p-5 text-white">
        <div>
          <p className="text-sm font-bold text-white/70">{sector.crag.name}</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">{sector.name}</h1>
          <p className="mt-2 text-sm font-semibold text-white/80">{sector.summary}</p>
        </div>
      </section>
      <nav className="flex gap-2 overflow-x-auto px-5 py-4">
        {sector.tabs.map((tab) => (
          <TabLink
            key={tab}
            href={`/c/${sector.crag.slug}/s/${sector.slug}?tab=${tab.toLowerCase()}`}
            label={tab}
            active={tab === activeTab}
          />
        ))}
      </nav>
      <section className="space-y-5 px-5">
        {activeTab === "Info" ? (
          <>
            <InfoBlock title="접근" body={sector.accessDesc} />
            <InfoBlock title="주차" body={sector.parkingDesc} />
          </>
        ) : null}
        {activeTab === "Boulder" ? (
          <div className="space-y-4">
            {sector.boulders.map((boulder) => (
              <BoulderCard key={boulder.id} boulder={boulder} href={`/c/${sector.crag.slug}/b/${boulder.id}`} />
            ))}
          </div>
        ) : null}
        {activeTab === "Route" ? <RouteTable routes={sector.routes} /> : null}
        {activeTab === "Map" ? (
          <div className="grid min-h-[360px] place-items-center rounded-[28px] bg-[#F7F8F8] p-5 text-center">
            <p className="text-sm font-bold text-[#6F7477]">{sector.boulders.length}개 Boulder 마커</p>
          </div>
        ) : null}
        {activeTab === "Travel" ? <InfoBlock title="Travel" body="Sector 범위의 교통/여행 정보는 공지 관리에서 확장합니다." /> : null}
      </section>
      <BottomNav />
    </main>
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
