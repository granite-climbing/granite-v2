"use client";

import { useState } from "react";
import { BetaVideoSheet } from "./beta-video-sheet";
import type { BetaVideoItem } from "./beta-video-grid";

export function BetaRouteActions({
  routeId,
  caption,
  betaVideos,
}: {
  routeId: string;
  caption: string;
  betaVideos: BetaVideoItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-6 w-[72px] items-center justify-center gap-1 rounded-full bg-[#E8E8E8] text-[12px] font-medium leading-4 text-[#3A3A3A]"
      >
        beta
      </button>
      {open ? (
        <BetaVideoSheet
          routeId={routeId}
          caption={caption}
          betaVideos={betaVideos}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
