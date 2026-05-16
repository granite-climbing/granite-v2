import Link from "next/link";
import type { Boulder } from "@/lib/db/schema";

type BoulderCardProps = {
  boulder: Boulder & { routeCount: number; gradeRange: string; hashtagsList: string[] };
  href: string;
};

export function BoulderCard({ boulder, href }: BoulderCardProps) {
  return (
    <Link href={href} className="block bg-white">
      <div className="grid h-[216px] place-items-center overflow-hidden rounded-[8px] bg-gradient-to-br from-[#C9C1B6] to-[#766B61] px-5 text-white">
        <span className="text-2xl font-black tracking-[-0.05em]">{boulder.name}</span>
      </div>
      <div className="space-y-2 py-3">
        <h3 className="text-xl font-black tracking-[-0.04em]">{boulder.name}</h3>
        <p className="text-sm font-semibold text-[#6F7477]">
          {boulder.routeCount} routes · {boulder.gradeRange}
        </p>
        <div className="flex flex-wrap gap-2">
          {boulder.hashtagsList.map((tag) => (
            <span key={tag} className="rounded-full bg-[#F7F8F8] px-3 py-1 text-xs font-bold text-[#6F7477]">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
