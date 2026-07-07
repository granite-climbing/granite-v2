"use client";

import React, { useActionState } from "react";
import type { ProjectActionResult } from "@/lib/actions/project";

type RouteSaveActionProps = {
  routeId: string;
  saved: boolean;
  loggedIn: boolean;
  returnTo: string;
  saveAction: (formData: FormData) => Promise<ProjectActionResult>;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
};

export function RouteSaveAction({
  routeId,
  saved,
  loggedIn,
  returnTo,
  saveAction,
  removeAction
}: RouteSaveActionProps) {
  const [result, formAction, pending] = useActionState(
    async (_state: ProjectActionResult | null, formData: FormData) =>
      saved ? removeAction(formData) : saveAction(formData),
    null
  );

  const label = saved ? "저장됨" : loggedIn ? "프로젝트 저장" : "로그인 후 저장";
  const className = saved
    ? "h-9 rounded-full bg-black px-4 text-[13px] font-bold text-white"
    : "h-9 rounded-full border border-black px-4 text-[13px] font-bold text-black";

  return (
    <form action={formAction}>
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={className} disabled={pending}>
        {label}
      </button>
      {result && !result.ok ? (
        <p role="status" className="mt-1 text-[11px] font-semibold text-[#D32F2F]">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
