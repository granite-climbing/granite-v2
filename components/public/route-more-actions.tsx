"use client";

import React, { useState } from "react";
import { RouteMoreSheet, type RouteMoreSheetProps } from "./route-more-sheet";

export type RouteMoreActionsProps = Omit<RouteMoreSheetProps, "onClose">;

export function RouteMoreActions(props: RouteMoreActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-6 w-[72px] items-center justify-center rounded-full bg-[#E8E8E8] text-[12px] font-medium leading-4 text-[#3A3A3A]"
      >
        More
      </button>
      {open ? <RouteMoreSheet {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
