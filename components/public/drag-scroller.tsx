// components/public/drag-scroller.tsx
"use client";

import { forwardRef, useImperativeHandle, useRef, type PointerEvent, type ReactNode, type UIEvent } from "react";

type DragScrollerProps = {
  /** Tailwind/CSS classes applied to the scroll container. Must include `overflow-x-auto`. */
  className?: string;
  children: ReactNode;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
};

/**
 * Wraps a horizontal scroll container and adds click-and-drag panning via Pointer Events.
 * Native touch scrolling on mobile is preserved (we only intercept mouse/pen pointers).
 * The component is a leaf client wrapper; children may be Server Components rendered up the tree.
 */
export const DragScroller = forwardRef<HTMLDivElement, DragScrollerProps>(function DragScroller(
  { className, children, onScroll },
  forwardedRef
) {
  const ref = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);
  const drag = useRef<{ startX: number; startScroll: number; pointerId: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Only intercept mouse/pen — leave touch to native momentum scroll.
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    drag.current = { startX: e.clientX, startScroll: el.scrollLeft, pointerId: e.pointerId };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.scrollLeft = d.startScroll - (e.clientX - d.startX);
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  return (
    <div
      ref={ref}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onScroll={onScroll}
      style={{ cursor: "grab", touchAction: "pan-y" }}
    >
      {children}
    </div>
  );
});
