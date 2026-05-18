import Link from "next/link";
import type { RouteListItem } from "@/lib/db/schema";

type RouteTableProps = {
  routes: RouteListItem[];
};

export function RouteTable({ routes }: RouteTableProps) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#E8E8E8] bg-white">
      {routes.map((route, index) => (
        <Link
          key={route.id}
          href={`/topos/${route.topoId}?route=${route.id}`}
          className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-[#F1F1EF] px-4 py-3 last:border-b-0"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#1A1A1A] text-xs font-black text-white">
            {index + 1}
          </span>
          <span>
            <span className="block text-sm font-black">{route.name}</span>
            <span className="block text-xs font-semibold text-[#6F7477]">{route.boulderName}</span>
          </span>
          <span className="rounded-full bg-[#F7F8F8] px-3 py-1 text-xs font-black">{route.grade}</span>
        </Link>
      ))}
    </div>
  );
}
