import Link from "next/link";
import type { AreaDetail } from "@/lib/db/schema";

type AreaCragCardProps = {
  crag: AreaDetail["crags"][number];
};

/**
 * Horizontal dark crag card for the Area page list (Figma `area` frame):
 * 100px-tall #2A2A2A card with an 84px thumbnail, name, counts line,
 * mini grade bars, and a trailing chevron.
 */
export function AreaCragCard({ crag }: AreaCragCardProps) {
  return (
    <Link
      href={`/c/${crag.slug}`}
      className="flex h-[100px] items-center overflow-hidden rounded-[8px] bg-[#2A2A2A] transition-colors hover:bg-[#3A3A3A]"
    >
      <div
        className="ml-2 size-[84px] shrink-0 rounded-[4px] bg-[#D9D9D9] bg-cover bg-center"
        style={
          crag.coverImageUrl
            ? { backgroundImage: `url("${crag.coverImageUrl}")` }
            : undefined
        }
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center pl-3 pr-2">
        <h3 className="truncate text-[16px] font-bold leading-6 text-white">
          {crag.name}
        </h3>
        <p className="mt-[2px] text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
          {crag.stats.sectors} Sectors · {crag.stats.boulders} Boulders ·{" "}
          {crag.stats.routes} Routes
        </p>
        <GradeBars gradeCounts={crag.gradeCounts} />
      </div>
      <span className="shrink-0 pr-3 text-[18px] leading-none text-[#7A7A7A]">
        ›
      </span>
    </Link>
  );
}

function GradeBars({ gradeCounts }: { gradeCounts: number[] }) {
  const max = Math.max(...gradeCounts, 1);
  return (
    <div className="mt-2 flex items-end gap-1" aria-label="V등급 분포">
      {gradeCounts.map((count, i) => (
        <div
          key={i}
          className="w-2 rounded-[2px] bg-[#7A7A7A]"
          style={{
            height: `${count === 0 ? 2 : Math.max(2, Math.round((count / max) * 24))}px`,
            opacity: count === 0 ? 0.25 : 1,
          }}
        />
      ))}
    </div>
  );
}
