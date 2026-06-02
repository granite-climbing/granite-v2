import Link from "next/link";
import { notFound } from "next/navigation";
import { findTopoById } from "@/lib/db/repository";
import { TopoNavArrow } from "@/components/public/topo-nav";
import type { Route, TopoDetail } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

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
          className="absolute bottom-4 right-4 grid size-11 place-items-center rounded-full bg-[#2A2A2A] text-white"
          aria-label="로드맵 보기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="size-5"
          >
            <path
              d="M14.9497 9.9497C16.7347 8.1648 17.3542 5.65558 16.8081 3.36796L19.303 2.2987C19.5569 2.18992 19.8508 2.30749 19.9596 2.56131C19.9862 2.62355 20 2.69056 20 2.75827V17L13 20L7 17L0.69696 19.7013C0.44314 19.8101 0.14921 19.6925 0.0404301 19.4387C0.0137501 19.3765 0 19.3094 0 19.2417V5L3.12892 3.65904C2.70023 5.86632 3.34067 8.2402 5.05025 9.9497L10 14.8995L14.9497 9.9497ZM13.5355 8.5355L10 12.0711L6.46447 8.5355C4.51184 6.58291 4.51184 3.41709 6.46447 1.46447C8.4171 -0.488158 11.5829 -0.488158 13.5355 1.46447C15.4882 3.41709 15.4882 6.58291 13.5355 8.5355Z"
              fill="currentColor"
            />
          </svg>
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
        <TopoNavArrow topoId={topo.prevTopoId} direction="prev" />
        <h2 className="text-center text-[18px] font-medium leading-6 text-[#090909]">
          {topo.boulder.name} {topo.topoIndex}/{topo.topoCount}
        </h2>
        <TopoNavArrow topoId={topo.nextTopoId} direction="next" />
      </div>
      <div className="mt-3 border-y border-[#E8E8E8]">
        {topo.routes.map((route, index) => {
          const selected = route.id === selectedRoute?.id;
          return (
            <Link
              key={route.id}
              href={selected ? `/t/${topo.id}` : `/t/${topo.id}?route=${route.id}`}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 15 11"
                    fill="none"
                    aria-hidden="true"
                    className="size-[11px] shrink-0 text-[#5A5A5A]"
                  >
                    <path
                      d="M10.6667 3.46667L14.1422 1.03381C14.293 0.928233 14.5009 0.964913 14.6064 1.11573C14.6456 1.17176 14.6667 1.23849 14.6667 1.30689V9.3598C14.6667 9.54387 14.5174 9.69313 14.3333 9.69313C14.2649 9.69313 14.1982 9.67207 14.1422 9.63287L10.6667 7.2V10C10.6667 10.3682 10.3682 10.6667 10 10.6667H0.666667C0.29848 10.6667 0 10.3682 0 10V0.666667C0 0.29848 0.29848 0 0.666667 0H10C10.3682 0 10.6667 0.29848 10.6667 0.666667V3.46667Z"
                      fill="currentColor"
                    />
                  </svg>
                  beta
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
