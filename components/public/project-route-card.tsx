"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import type { ProjectActionResult } from "@/lib/actions/project";
import type { SavedRouteListItem } from "@/lib/db/schema";

type ProjectRouteCardProps = {
  route: SavedRouteListItem;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
};

export function ProjectRouteCard({ route, removeAction }: ProjectRouteCardProps) {
  const [, formAction, pending] = useActionState(
    async (_state: ProjectActionResult | null, formData: FormData) => removeAction(formData),
    null
  );

  const href = `/t/${route.topoId}?route=${route.id}`;
  const context = `${route.cragName} · ${route.sectorName} · ${route.boulderName}`;

  return (
    <article className="border-b border-[#ECECEC] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href}>
            <span className="block text-[17px] font-black leading-6 text-black">
              {route.name} <span className="text-[#6F7477]">{route.grade}</span>
            </span>
          </Link>
          <span className="mt-1 block text-[12px] font-semibold leading-4 text-[#6F7477]">{context}</span>
        </div>
        <form action={formAction}>
          <input type="hidden" name="routeId" value={route.id} />
          <input type="hidden" name="returnTo" value="/me/projects" />
          <button
            type="submit"
            disabled={pending}
            className="h-8 shrink-0 rounded-full border border-[#D9D9D9] px-3 text-[12px] font-bold text-[#4F5558]"
          >
            프로젝트에서 제거
          </button>
        </form>
      </div>
    </article>
  );
}
