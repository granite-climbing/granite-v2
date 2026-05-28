import Link from "next/link";
import { notFound } from "next/navigation";
import { findTopoById } from "@/lib/db/repository";
import type { Route, TopoDetail } from "@/lib/db/schema";

type TopoPageProps = {
  params: Promise<{ topoId: string }>;
  searchParams?: Promise<{ route?: string }>;
};

export default async function TopoPage({ params, searchParams }: TopoPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const topo = await findTopoById(resolvedParams.topoId);
  if (!topo) {
    notFound();
  }

  const selectedRoute = topo.routes.find((route) => route.id === resolvedSearchParams?.route);
  const imageUrl = selectedRoute?.lineImageUrl || topo.baseImageUrl;

  return (
    <main className="min-h-screen bg-white text-[#090909]">
      <TopoHeader topo={topo} />
      <section
        className="relative h-[270px] bg-[#BABABA] bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      >
        <Link
          href={`/c/${topo.crag.slug}?tab=route`}
          className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-[#2A2A2A] text-[22px] text-white"
          aria-label="로드맵 보기"
        >
          ◒
        </Link>
      </section>
      <TopoRouteSheet topo={topo} selectedRoute={selectedRoute} />
    </main>
  );
}

function TopoHeader({ topo }: { topo: TopoDetail }) {
  return (
    <header className="relative flex h-14 items-center justify-center bg-white">
      <Link
        href={`/c/${topo.crag.slug}?tab=route`}
        className="absolute left-4 grid size-6 place-items-center text-[24px] leading-6"
        aria-label="뒤로 가기"
      >
        ‹
      </Link>
      <h1 className="text-[18px] font-medium leading-6 text-[#090909]">{topo.crag.name}</h1>
    </header>
  );
}

function TopoRouteSheet({ topo, selectedRoute }: { topo: TopoDetail; selectedRoute?: Route }) {
  return (
    <section className="bg-white px-4 pb-10 pt-2">
      <div className="mx-auto h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
      <div className="mt-2 flex h-9 items-center justify-between">
        <span className="grid size-6 place-items-center text-[26px] leading-6 text-[#B8B8B8]">←</span>
        <h2 className="text-center text-[18px] font-medium leading-6 text-[#090909]">
          {topo.boulder.name} {topo.topoIndex}/{topo.topoCount}
        </h2>
        <span className="grid size-6 place-items-center text-[30px] leading-6 text-[#090909]">→</span>
      </div>
      <div className="mt-3 border-y border-[#E8E8E8]">
        {topo.routes.map((route, index) => {
          const selected = route.id === selectedRoute?.id;
          return (
            <Link
              key={route.id}
              href={selected ? `/topos/${topo.id}` : `/topos/${topo.id}?route=${route.id}`}
              className={`grid min-h-[88px] grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-[#E8E8E8] px-2 last:border-b-0 ${
                selected ? "bg-[#F1F1F1]" : "bg-white"
              }`}
            >
              <span className="grid size-6 place-items-center rounded-full bg-[#2A2A2A] text-[14px] font-medium leading-5 text-white">
                {index + 1}
              </span>
              <span>
                <span className="block text-[18px] font-medium leading-6 text-[#2A2A2A]">{route.name}</span>
                <span className="mt-1 block text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
                  {topo.boulder.name}
                </span>
                <span className="block text-[10px] font-normal leading-[14px] text-[#7A7A7A]">FA {route.fa}</span>
              </span>
              <span className="flex flex-col items-end gap-2">
                <span className="text-[18px] font-medium leading-6 text-[#2A2A2A]">{route.grade}</span>
                <span className="flex h-6 w-[72px] items-center justify-center gap-1 rounded-full bg-[#E8E8E8] text-[12px] font-medium leading-4 text-[#3A3A3A]">
                  ▪ beta
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
