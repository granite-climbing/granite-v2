import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { findBoulderById, findCragBySlug } from "@/lib/db/repository";

type BoulderPageProps = {
  params: { cragSlug: string; boulderId: string };
};

export default function BoulderPage({ params }: BoulderPageProps) {
  const crag = findCragBySlug(params.cragSlug);
  const boulder = findBoulderById(params.boulderId);
  if (!crag || !boulder) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#F1F1EF]">
      <AppHeader />
      <section className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-[28px] bg-white p-5 shadow-card">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#D9D9D9]" />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-[-0.05em]">{boulder.name}</h1>
          <Link href={`/c/${crag.slug}?tab=boulder`} className="grid size-10 place-items-center rounded-full bg-[#F7F8F8]">
            ×
          </Link>
        </div>
        {boulder.topos.map((topo, topoIndex) => (
          <article key={topo.id} className="mt-5">
            <p className="mb-3 text-sm font-bold text-[#6F7477]">
              {topo.name} {topoIndex + 1}/{boulder.topos.length}
            </p>
            <div className="grid h-[270px] place-items-center rounded-[24px] bg-gradient-to-br from-[#C9C1B6] to-[#766B61] text-white">
              Topo Image
            </div>
            <div className="mt-4 overflow-hidden rounded-[22px] border border-[#E8E8E8]">
              {topo.routes.map((route, index) => (
                <Link
                  key={route.id}
                  href={`/r/${route.id}`}
                  className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-[#F1F1EF] px-4 py-3 last:border-b-0"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-[#1A1A1A] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-black">{route.name}</span>
                    <span className="block text-xs font-semibold text-[#6F7477]">{boulder.name}</span>
                  </span>
                  <span className="rounded-full bg-[#E8E8E8] px-3 py-1 text-xs font-black">beta</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
