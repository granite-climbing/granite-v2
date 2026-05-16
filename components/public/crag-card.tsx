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
      className="block w-[270px] shrink-0 overflow-hidden rounded-[8px] bg-white"
    >
      <div className="relative grid h-[168px] place-items-center overflow-hidden bg-[linear-gradient(135deg,#d7d1c7_0%,#9d8c7d_52%,#554a42_100%)] px-5 text-white">
        <div className="absolute inset-0 bg-black/15" />
        <span className="relative text-[28px] font-black tracking-[-0.06em]">{crag.name}</span>
      </div>
      <div className="space-y-3 px-1 py-3">
        <div>
          <h3 className="text-[20px] font-black leading-tight tracking-[-0.04em]">{crag.name}</h3>
          <p className="text-xs font-semibold text-[#6F7477]">
            {crag.stats.sectors} sectors · {crag.stats.boulders} boulders · {crag.stats.routes} routes
          </p>
        </div>
        <StatBar />
      </div>
    </Link>
  );
}
