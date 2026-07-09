"use client";

import React, { useState } from "react";
import { AddRecordDialog } from "./add-record-dialog";

export function AddRecordLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[14px] font-medium leading-5 text-[#090909]"
      >
        기록 추가
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-[#090909]" strokeWidth="1.4">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
      {open ? <AddRecordDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
