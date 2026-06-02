// components/public/drag-scroller.tsx
"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type UIEvent,
} from "react";

type DragScrollerProps = {
  /** Tailwind/CSS classes applied to the scroll container. Must include `overflow-x-auto`. */
  className?: string;
  children: ReactNode;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
};

/** Pixels of pointer movement before we treat the gesture as a drag (not a click). */
const DRAG_THRESHOLD = 4;

/**
 * Wraps a horizontal scroll container and adds click-and-drag panning via Pointer Events.
 *
 * Behaviour:
 *  - Touch pointers fall through to native momentum scroll.
 *  - Mouse / pen pointers drive `scrollLeft` while the button is held.
 *  - When children are `<Link>` or `<a>` elements, the native browser link-drag is
 *    suppressed via `preventDefault()` on `pointerdown`, and a synthetic click is
 *    blocked at the capture phase if the user actually dragged. This way:
 *      - A pure click on a card still navigates.
 *      - A drag pans the slider and does NOT trigger navigation.
 */
export const DragScroller = forwardRef<HTMLDivElement, DragScrollerProps>(function DragScroller(
  { className, children, onScroll },
  forwardedRef
) {
  const ref = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);

  const drag = useRef<{
    startX: number;
    startScroll: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  /** Latched true if the just-finished gesture was a drag — used to suppress the trailing click. */
  const didDrag = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Only intercept mouse/pen — leave touch to native momentum scroll.
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    // Suppress native link-drag / image-drag so we can pan instead.
    e.preventDefault();
    drag.current = {
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      moved: false,
    };
    didDrag.current = false;
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      didDrag.current = true;
    }
    el.scrollLeft = d.startScroll - dx;
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  /**
   * Capture-phase click handler — runs before any descendant click handlers (including
   * Next.js `<Link>`). If the just-finished gesture was a drag, kill the click so
   * accidental navigation does not happen.
   */
  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
      didDrag.current = false;
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      onScroll={onScroll}
      style={{ cursor: "grab", touchAction: "pan-y", userSelect: "none" }}
    >
      {children}
    </div>
  );
});
