// components/public/drag-scroller.tsx
"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type DragEvent,
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
 *  - Mouse / pen pointers drive `scrollLeft` 1:1 while the button is held.
 *  - Native browser link/image drag (which would otherwise hijack the gesture on `<a>`
 *    and `<img>` children) is suppressed by `preventDefault()` on the `dragstart` event.
 *    We do NOT preventDefault on `pointerdown` because that would also kill the trailing
 *    `click`, breaking simple clicks on child links.
 *  - To keep panning smooth, we temporarily disable CSS scroll-snap during the drag and
 *    restore it on release — `snap-mandatory` otherwise re-aligns scrollLeft every frame
 *    and the gesture feels jerky.
 *  - A pure click (movement below DRAG_THRESHOLD) navigates as normal. After a real drag,
 *    the synthetic click is blocked at the capture phase so accidentally panning across
 *    a `<Link>` does not navigate.
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
    /** scroll-snap-type value captured from the element so we can restore it on release. */
    snapBefore: string;
  } | null>(null);
  /** Latched true if the just-finished gesture was a drag — used to suppress the trailing click. */
  const didDrag = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Only intercept mouse/pen — leave touch to native momentum scroll.
    if (e.pointerType === "touch") return;
    // Only react to the primary mouse button.
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    drag.current = {
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      moved: false,
      snapBefore: el.style.scrollSnapType,
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
      // Disable snap so 1:1 dragging feels smooth — `mandatory` otherwise snaps
      // scrollLeft to the nearest snap-start child on every frame.
      el.style.scrollSnapType = "none";
    }
    if (d.moved) {
      el.scrollLeft = d.startScroll - dx;
    }
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.releasePointerCapture(e.pointerId);
    // Restore CSS-managed snap behaviour. The browser will snap to the nearest point
    // now that the gesture has ended.
    el.style.scrollSnapType = d.snapBefore;
    drag.current = null;
  }

  /**
   * Capture-phase click handler — runs before any descendant click handlers (including
   * Next.js `<Link>`). If the just-finished gesture was a drag, kill the click so
   * accidental navigation does not happen. Pure clicks pass through.
   */
  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
      didDrag.current = false;
    }
  }

  /** Suppress native HTML5 drag-and-drop for child links / images. */
  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
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
      onDragStart={onDragStart}
      onScroll={onScroll}
      style={{ cursor: "grab", touchAction: "pan-y", userSelect: "none" }}
    >
      {children}
    </div>
  );
});
