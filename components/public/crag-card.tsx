import Link from "next/link";
import type { Crag } from "@/lib/db/schema";
import { StatBar } from "./stat-bar";

type CragCardProps = {
  crag: Crag & {
    stats: { sectors: number; boulders: number; routes: number };
    gradeCounts: number[];
  };
};

export function CragCard({ crag }: CragCardProps) {
  return (
    <Link
      href={`/c/${crag.slug}`}
      className="block w-[270px] shrink-0 overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]"
    >
      <div
        className="aspect-[3/2] bg-cover bg-center"
        style={{ backgroundImage: `url("${crag.coverImageUrl}")` }}
      />
      <div className="px-4 pb-4 pt-4">
        <div>
          <h3 className="text-[16px] font-bold leading-6 text-[#090909]">{crag.name}</h3>
          <p className="mt-1 text-[12px] font-medium leading-4 text-[#7A7A7A]">
            {crag.stats.sectors} sectors · {crag.stats.boulders} boulders · {crag.stats.routes} routes
          </p>
        </div>
        <div className="mt-3">
          <StatBar gradeCounts={crag.gradeCounts} variant="compact" />
        </div>
      </div>
    </Link>
  );
}
