import Link from "next/link";
import type { Area } from "@/lib/db/schema";

type AreaCardStats = {
  crags: number;
  sectors: number;
  boulders: number;
  routes: number;
};

type AreaCardProps = {
  area: Area & { stats: AreaCardStats };
  href: string;
};

export function AreaCard({ area, href }: AreaCardProps) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-[8px] bg-white shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]"
    >
      {/* Cover image */}
      <div
        className="h-[140px] w-full bg-cover bg-center bg-[#BABABA]"
        style={area.coverImageUrl ? { backgroundImage: `url("${area.coverImageUrl}")` } : undefined}
      />
      {/* Info */}
      <div className="px-4 py-3">
        <h3 className="text-[16px] font-bold leading-6 text-[#090909]">{area.name}</h3>
        {area.nameEn ? (
          <p className="text-[12px] font-normal leading-4 text-[#7A7A7A]">{area.nameEn}</p>
        ) : null}
        <p className="mt-1 text-[12px] font-medium leading-4 text-[#7A7A7A]">
          {area.stats.crags} Crags · {area.stats.sectors} Sectors · {area.stats.boulders} Boulders ·{" "}
          {area.stats.routes} Routes
        </p>
      </div>
    </Link>
  );
}
