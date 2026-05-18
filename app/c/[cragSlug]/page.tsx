import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { findCragBySlug } from "@/lib/db/repository";
import type { CragDetail, RouteListItem, TabName } from "@/lib/db/schema";

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
      <section className="space-y-6 px-4 pt-2">
        {crag.sectors.map((sector) => (
          <ImageListCard
            key={sector.id}
            href={`/c/${crag.slug}/s/${sector.slug}`}
            imageUrl={sector.coverImageUrl}
            title={sector.name}
            meta={`${sector.season} · ${sector.summary}`}
          />
        ))}
      </section>
    );
  }

  if (activeTab === "Boulder") {
    return (
      <section className="space-y-6 px-4 pt-2">
        {crag.boulders.map((boulder) => (
          <ImageListCard
            key={boulder.id}
            href={`/c/${crag.slug}/b/${boulder.id}`}
            imageUrl={boulder.coverImageUrl}
            title={boulder.name}
            meta={`${boulder.routeCount} problems · ${boulder.gradeRange}`}
          />
        ))}
      </section>
    );
  }

  if (activeTab === "Route") {
    return <RoutePanel routes={crag.routes} />;
  }

  if (activeTab === "Map") {
    return (
      <section className="px-4 pt-2">
        <MapPreview crag={crag} variant="large" />
      </section>
    );
  }

  return <TravelPanel crag={crag} />;
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

function ImageListCard({
  href,
  imageUrl,
  title,
  meta
}: {
  href: string;
  imageUrl: string;
  title: string;
  meta: string;
}) {
  return (
    <Link href={href} className="block">
      <div
        className="h-[216px] rounded-[8px] bg-[#BABABA] bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      <h2 className="mt-3 text-[20px] font-bold leading-7 text-[#090909]">{title}</h2>
      <p className="mt-1 text-[14px] font-medium leading-5 text-[#7A7A7A]">{meta}</p>
    </Link>
  );
}

function RoutePanel({ routes }: { routes: RouteListItem[] }) {
  return (
    <section className="px-4 pt-2">
      <label className="relative block">
        <span className="sr-only">루트 검색</span>
        <input
          className="h-12 w-full rounded-full border border-[#B8B8B8] bg-white px-12 text-[14px] font-medium leading-5 text-[#090909] outline-none placeholder:text-[#7A7A7A]"
          placeholder="루트 이름 검색, 난이도 검색"
        />
        <span className="absolute left-4 top-3 flex size-6 items-center justify-center text-[20px] leading-6 text-[#B8B8B8]">
          ⌕
        </span>
      </label>
      <div className="mt-6">
        <div className="grid h-10 grid-cols-[159px_73px_80px] items-center bg-[#F7F8F8] px-2 text-[14px] font-medium leading-5 text-[#090909]">
          <span>Route</span>
          <span>Grade⌄</span>
          <span>Boulder</span>
        </div>
        <div className="border-b border-[#E8E8E8]">
          {routes.map((route) => (
            <Link
              key={route.id}
              href={`/r/${route.id}`}
              className="grid h-10 grid-cols-[159px_73px_80px] items-center border-t border-[#E8E8E8] px-2 text-[14px] font-normal leading-5 text-[#2A2A2A]"
            >
              <span className="truncate pr-2">{route.name}</span>
              <span>{route.grade}</span>
              <span className="truncate">{route.boulderName}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function MapPreview({ crag, variant = "default" }: { crag: CragDetail; variant?: "default" | "large" }) {
  const heightClass = variant === "large" ? "h-[400px]" : "h-[216px]";

  return (
    <div className={`relative grid ${heightClass} place-items-center overflow-hidden rounded-[8px] bg-[#E7F1E7]`}>
      <div className="absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(34deg,transparent_0,transparent_14px,rgba(122,122,122,0.16)_15px,transparent_16px)]" />
      <div className="absolute left-[112px] top-[-24px] h-[480px] w-[24px] rotate-[-24deg] rounded-full bg-white" />
      <div className="absolute left-[146px] top-[-24px] h-[480px] w-[14px] rotate-[-24deg] rounded-full bg-[#99C9D8]" />
      <div className="absolute left-[166px] top-[26px] flex flex-col gap-2">
        {crag.boulders.slice(0, 5).map((boulder) => (
          <span
            key={boulder.id}
            className="grid size-3 place-items-center rounded-full bg-[#EA6AD9] text-[8px] leading-none text-white"
          >
            ★
          </span>
        ))}
      </div>
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

function TravelPanel({ crag }: { crag: CragDetail }) {
  const items = buildTravelItems(crag);

  return (
    <section className="px-4 pt-2">
      <div className="border-t border-[#E8E8E8]">
        {items.map((item) => (
          <article key={item.id} className="grid h-[138px] grid-cols-[1fr_88px] gap-4 border-b border-[#E8E8E8] py-4">
            <div>
              <h2 className="line-clamp-2 text-[18px] font-medium leading-6 text-[#090909]">{item.title}</h2>
              <p className="mt-[6px] line-clamp-2 text-[12px] font-normal leading-4 text-[#7A7A7A]">{item.body}</p>
              <p className="mt-2 text-[10px] font-normal leading-[14px] text-[#7A7A7A]">{item.date}</p>
            </div>
            <div
              className="size-[88px] rounded-[8px] bg-[#BABABA] bg-cover bg-center"
              style={{ backgroundImage: `url("${item.imageUrl}")` }}
            />
          </article>
        ))}
      </div>
      <div className="mt-[30px] flex items-center justify-center gap-6 text-[12px] font-normal leading-4">
        <span className="text-[#090909]">‹</span>
        {[1, 2, 3, 4, 5].map((page) => (
          <span key={page} className={page === 1 ? "text-[#090909]" : "text-[#B8B8B8]"}>
            {page}
          </span>
        ))}
        <span className="text-[#090909]">›</span>
      </div>
    </section>
  );
}

function buildTravelItems(crag: CragDetail) {
  const baseItems = [
    { id: "access", title: `${crag.name} 접근 안내`, body: crag.accessDesc },
    { id: "parking", title: `${crag.name} 주차 정보`, body: crag.parkingDesc },
    { id: "season", title: `${crag.name} 시즌과 컨디션`, body: crag.summary },
    { id: "sector", title: "추천 섹터와 동선", body: crag.sectors.map((sector) => sector.name).join(", ") },
    { id: "boulder", title: "대표 볼더 체크리스트", body: crag.boulders.map((boulder) => boulder.name).join(", ") }
  ];

  return baseItems.map((item) => ({
    ...item,
    date: "2023.08.25",
    imageUrl: crag.coverImageUrl
  }));
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
