import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { findRouteById } from "@/lib/db/repository";

type RoutePageProps = {
  params: { routeId: string };
};

export default function RoutePage({ params }: RoutePageProps) {
  const route = findRouteById(params.routeId);
  if (!route) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white pb-6">
      <AppHeader />
      <section className="grid h-[260px] place-items-center bg-gradient-to-br from-[#C9C1B6] to-[#766B61] p-5 text-center text-white">
        <div>
          <p className="text-sm font-bold text-white/70">
            {route.cragName} · {route.sectorName} · {route.boulderName}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.08em]">{route.name}</h1>
          <p className="mt-3 text-2xl font-black">{route.grade}</p>
        </div>
      </section>
      <section className="space-y-5 px-5 py-6">
        <article className="rounded-[24px] bg-[#F7F8F8] p-5">
          <h2 className="text-lg font-black">Route Info</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#6F7477]">{route.description}</p>
          <p className="mt-3 text-xs font-bold text-[#8B8F91]">FA {route.fa}</p>
        </article>
        <article className="rounded-[24px] bg-[#1A1A1A] p-5 text-white">
          <h2 className="text-lg font-black">Beta</h2>
          <p className="mt-2 text-sm font-semibold text-white/70">Phase 2에서 캡션 복사와 수동 베타 등록이 연결됩니다.</p>
        </article>
        <Link
          href={`/c/${route.cragSlug}/s/${route.sectorSlug}?tab=route`}
          className="block rounded-full bg-[#F7F8F8] px-5 py-3 text-center text-sm font-black"
        >
          Sector Route 목록으로 돌아가기
        </Link>
      </section>
      <BottomNav />
    </main>
  );
}
