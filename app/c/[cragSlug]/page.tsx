import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BoulderCard } from "@/components/public/boulder-card";
import { RouteTable } from "@/components/public/route-table";
import { findCragBySlug } from "@/lib/db/repository";
import type { CragDetail, TabName } from "@/lib/db/schema";

type CragPageProps = {
  params: Promise<{ cragSlug: string }>;
  searchParams?: Promise<{ tab?: string }>;
};

export default async function CragPage({ params, searchParams }: CragPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const crag = findCragBySlug(resolvedParams.cragSlug);
  if (!crag) {
    notFound();
  }

  const activeTab = crag.tabs.find((tab) => tab.toLowerCase() === resolvedSearchParams?.tab?.toLowerCase()) ?? "Info";

  return (
    <main className="min-h-screen bg-white pb-10 text-[#090909]">
      <AppHeader />
      <CragHero crag={crag} />
      <CragTabs crag={crag} activeTab={activeTab} />
      <CragTabPanel crag={crag} activeTab={activeTab} />
    </main>
  );
}

function CragHero({ crag }: { crag: CragDetail }) {
  return (
    <section
      className="relative flex h-[240px] items-center justify-center overflow-hidden bg-cover bg-center px-4 text-center text-white"
      style={{ backgroundImage: `url("${crag.coverImageUrl}")` }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative max-w-[328px]">
        <h1 className="text-[28px] font-extrabold leading-9">{crag.name}</h1>
        <p className="mt-4 text-[12px] font-normal leading-4 text-white">{crag.summary}</p>
      </div>
    </section>
  );
}

function CragTabs({ crag, activeTab }: { crag: CragDetail; activeTab: TabName }) {
  return (
    <nav className="flex h-14 justify-center gap-4 pt-3" aria-label="Crag 상세 탭">
      {crag.tabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Link
            key={tab}
            href={`/c/${crag.slug}?tab=${tab.toLowerCase()}`}
            className={`relative flex h-8 shrink-0 items-center text-[14px] leading-5 ${
              active ? "font-medium text-[#090909]" : "font-normal text-[#7A7A7A]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab}
            {active ? <span className="absolute bottom-0 left-0 h-px w-full bg-[#090909]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function CragTabPanel({ crag, activeTab }: { crag: CragDetail; activeTab: TabName }) {
  if (activeTab === "Info") {
    return <InfoPanel crag={crag} />;
  }

  if (activeTab === "Sector") {
    return (
      <section className="space-y-3 px-4 pt-8">
        {crag.sectors.map((sector) => (
          <Link key={sector.id} href={`/c/${crag.slug}/s/${sector.slug}`} className="block rounded-[8px] bg-[#F7F8F8] p-4">
            <h2 className="text-[18px] font-medium leading-6 text-[#2A2A2A]">{sector.name}</h2>
            <p className="mt-2 text-[14px] font-normal leading-5 text-[#5A5A5A]">{sector.summary}</p>
          </Link>
        ))}
      </section>
    );
  }

  if (activeTab === "Boulder") {
    return (
      <section className="space-y-6 px-4 pt-8">
        {crag.boulders.map((boulder) => (
          <BoulderCard key={boulder.id} boulder={boulder} href={`/c/${crag.slug}/b/${boulder.id}`} />
        ))}
      </section>
    );
  }

  if (activeTab === "Route") {
    return (
      <section className="px-4 pt-8">
        <RouteTable routes={crag.routes} />
      </section>
    );
  }

  if (activeTab === "Map") {
    return (
      <section className="px-4 pt-8">
        <MapPreview crag={crag} />
      </section>
    );
  }

  return (
    <section className="space-y-5 px-4 pt-8">
      <InfoRow icon="🚗" title="How to get there?" body={crag.accessDesc} />
      <InfoRow icon="🅿" title="Parking" body={crag.parkingDesc} />
      <div className="grid grid-cols-2 gap-2">
        <PillButton icon="P" label="Parking Spot" />
        <PillButton icon="☕" label="Cafe" />
      </div>
    </section>
  );
}

function InfoPanel({ crag }: { crag: CragDetail }) {
  return (
    <>
      <section className="grid h-[72px] place-items-center bg-[#F7F8F8]">
        <p className="text-center text-[18px] font-medium leading-6 text-[#2A2A2A]">
          {crag.stats.boulders} boulders · {crag.stats.routes} problems
        </p>
      </section>
      <section className="space-y-5 px-4 pt-8">
        <MapPreview crag={crag} />
        <InfoRow icon="●" title="Address" body={crag.accessDesc} />
        <InfoRow icon="▰" title="How to get there?" body={crag.parkingDesc} />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <PillButton icon="P" label="Parking Spot" />
          <PillButton icon="☕" label="Cafe" />
        </div>
      </section>
    </>
  );
}

function MapPreview({ crag }: { crag: CragDetail }) {
  return (
    <div className="relative grid h-[216px] place-items-center overflow-hidden rounded-[8px] bg-[#E7F1E7]">
      <div className="absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(34deg,transparent_0,transparent_14px,rgba(122,122,122,0.16)_15px,transparent_16px)]" />
      <div className="absolute left-[110px] top-0 h-[240px] w-[18px] rotate-[24deg] rounded-full bg-white" />
      <div className="absolute left-[132px] top-0 h-[240px] w-[8px] rotate-[24deg] rounded-full bg-[#99C9D8]" />
      <div className="relative text-center">
        <p className="text-[20px] font-bold leading-7 text-[#2A2A2A]">카카오맵 연동</p>
        {crag.lat && crag.lng ? (
          <p className="mt-1 text-[12px] font-normal leading-4 text-[#7A7A7A]">
            {crag.lat.toFixed(4)}, {crag.lng.toFixed(4)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center text-[18px] leading-6 text-[#090909]">{icon}</span>
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
