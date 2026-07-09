"use client";

// The default React import is required: vitest compiles JSX with the classic runtime.
import React, { useActionState, useOptimistic } from "react";
import Link from "next/link";
import { showToast } from "./toast";
import type { ProjectActionResult } from "@/lib/actions/project";
import type { SavedRouteListItem } from "@/lib/db/schema";

type ProjectRouteCardProps = {
  route: SavedRouteListItem;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
};

export function ProjectRouteCard({ route, removeAction }: ProjectRouteCardProps) {
  // 서버 왕복을 기다리지 않고 카드를 즉시 숨긴다. 액션이 실패하면
  // transition 종료와 함께 자동 롤백되고 에러 토스트를 띄운다.
  const [optimisticRemoved, setOptimisticRemoved] = useOptimistic(false);
  const [, formAction] = useActionState(
    async (_state: ProjectActionResult | null, formData: FormData) => {
      setOptimisticRemoved(true);
      const result = await removeAction(formData);
      if (!result.ok) {
        showToast(result.message, "error");
      }
      return result;
    },
    null
  );

  const href = `/t/${route.topoId}?route=${route.id}`;

  if (optimisticRemoved) {
    return null;
  }

  return (
    <article className="flex items-start justify-between gap-3 rounded-xl bg-white p-4">
      <Link href={href} className="block min-w-0">
        <span className="block truncate text-[16px] font-bold leading-6 text-black">{route.name}</span>
        <span className="mt-1 block text-[12px] font-medium leading-4 text-[#6F7477]">
          {route.grade} · {route.cragName}
        </span>
      </Link>
      <form action={formAction}>
        <input type="hidden" name="routeId" value={route.id} />
        <input type="hidden" name="returnTo" value="/me/projects" />
        <button
          type="submit"
          aria-label="프로젝트에서 제거"
          aria-pressed="true"
          className="shrink-0 text-[#121212] disabled:opacity-50"
        >
          <BookmarkIcon className="size-6" />
        </button>
      </form>
    </article>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
