import Link from "next/link";
import type { Area } from "@/lib/db/schema";

type RegionChipsProps = {
  areas: Area[];
  /** Active area id, or null when the 전체 (all-Korea) view is active. */
  activeAreaId: string | null;
};

/**
 * Region filter chips for the Area pages (Figma `area` frame):
 * 전체 (all-Korea view at /a) followed by every published area.
 */
export function RegionChips({ areas, activeAreaId }: RegionChipsProps) {
  return (
    <nav
      className="no-scrollbar flex gap-[6px] overflow-x-auto px-4 pt-3"
      aria-label="지역 선택"
    >
      <RegionChip href="/a" label="전체" active={activeAreaId === null} />
      {areas.map((area) => (
        <RegionChip
          key={area.id}
          href={`/a/${area.slug}`}
          label={area.name}
          active={area.id === activeAreaId}
        />
      ))}
    </nav>
  );
}

function RegionChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-[6px] text-center text-[14px] leading-5 ${
        active
          ? "bg-white font-medium text-[#090909]"
          : "bg-[#2A2A2A] font-normal text-white"
      }`}
    >
      {label}
    </Link>
  );
}
