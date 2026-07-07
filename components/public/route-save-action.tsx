import React from "react";
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
  const selectedAction = saved ? removeAction : saveAction;
  const action = async (formData: FormData) => {
    await selectedAction(formData);
  };
  const label = saved ? "저장됨" : loggedIn ? "프로젝트 저장" : "로그인 후 저장";
  const className = saved
    ? "h-9 rounded-full bg-black px-4 text-[13px] font-bold text-white"
    : "h-9 rounded-full border border-black px-4 text-[13px] font-bold text-black";

  return (
    <form action={action}>
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
