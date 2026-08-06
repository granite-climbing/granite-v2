import Link from "next/link";

type TopoNavArrowProps = {
  topoId: string | null;
  direction: "prev" | "next";
};

function TopoNavArrow({ topoId, direction }: TopoNavArrowProps) {
  const symbol = direction === "prev" ? "←" : "→";
  const label = direction === "prev" ? "이전 토포" : "다음 토포";
  const disabledLabel = direction === "prev" ? "이전 토포 없음" : "다음 토포 없음";
  // Slightly different font-size matches the original design (← 26px, → 30px)
  const sizeClass =
    direction === "prev"
      ? "grid size-6 place-items-center text-[26px] leading-6"
      : "grid size-6 place-items-center text-[30px] leading-6";

  if (topoId !== null) {
    return (
      <Link
        href={`/t/${topoId}`}
        replace
        className={`${sizeClass} text-[#090909]`}
        aria-label={label}
      >
        {symbol}
      </Link>
    );
  }

  return (
    <span
      className={`${sizeClass} text-[#B8B8B8]`}
      aria-disabled="true"
      aria-label={disabledLabel}
    >
      {symbol}
    </span>
  );
}

type TopoNavProps = {
  prevTopoId: string | null;
  nextTopoId: string | null;
};

/**
 * Renders previous and next Topo navigation arrows for the Topo detail page.
 * Each arrow is either a link (when a sibling topo exists) or a disabled span
 * (at boundaries). Server component — no "use client" needed.
 *
 * Usage: place the two arrows flanking the title by rendering TopoNavArrow
 * directly, or use the convenience wrapper which renders both.
 */
export function TopoNav({ prevTopoId, nextTopoId }: TopoNavProps) {
  return (
    <>
      <TopoNavArrow topoId={prevTopoId} direction="prev" />
      <TopoNavArrow topoId={nextTopoId} direction="next" />
    </>
  );
}

export { TopoNavArrow };
