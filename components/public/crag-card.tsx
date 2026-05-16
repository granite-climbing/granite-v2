import Link from "next/link";
import type { Crag } from "@/lib/db/schema";
import { StatBar } from "./stat-bar";

type CragCardProps = {
  crag: Crag & { stats: { sectors: number; boulders: number; routes: number } };
};

export function CragCard({ crag }: CragCardProps) {
  return (
    <Link
      href={`/c/${crag.slug}`}
      className="block w-[270px] shrink-0 overflow-hidden rounded-[28px] bg-white shadow-card"
    >
      <div className="grid h-[150px] place-items-center bg-gradient-to-br from-[#D5D0C7] to-[#9C8978] px-5 text-white">
        <span className="text-3xl font-black tracking-[-0.06em]">{crag.name}</span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-xl font-black tracking-[-0.04em]">{crag.name}</h3>
          <p className="text-xs font-semibold text-[#6F7477]">
            {crag.stats.sectors} sectors · {crag.stats.boulders} boulders · {crag.stats.routes} routes
          </p>
        </div>
        <StatBar />
      </div>
    </Link>
  );
}
