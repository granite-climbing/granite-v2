// components/public/drag-scroller.tsx
"use client";

import {
  forwardRef,
  useEffect,
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
/** Per-frame velocity decay (assuming ~60fps). 0.95 → ~5% drop per 16 ms. */
const FRICTION = 0.95;
/** Below this speed (px/ms) the fling stops and CSS snap takes over. */
const MIN_VELOCITY = 0.02;
/** Velocity window used to compute release velocity from recent pointer samples (ms). */
const VELOCITY_WINDOW_MS = 80;

type VelocitySample = { t: number; x: number };

/**
 * Wraps a horizontal scroll container and adds click-and-drag panning with momentum.
 *
 * Behaviour:
 *  - Touch pointers fall through to native momentum scroll.
 *  - Mouse / pen drag drives `scrollLeft` 1:1 while the button is held.
 *  - On release, the recent pointer velocity is sampled and the scroll continues with
 *    exponential friction (a "fling") until it slows below `MIN_VELOCITY`, then the
 *    CSS scroll-snap behaviour takes over for the final settle.
 *  - CSS scroll-snap is temporarily disabled during the active drag/fling so the motion
 *    is smooth instead of jerking to each snap point every frame.
 *  - Native browser link/image drag is suppressed by `preventDefault()` on `dragstart`.
 *    A pure click still navigates; only clicks immediately following a real drag are
 *    blocked at the capture phase.
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
    /** Scroll-snap-type value captured from the element so we can restore it on release. */
    snapBefore: string;
    /** Recent (t, clientX) samples for release-velocity estimation. */
    samples: VelocitySample[];
  } | null>(null);
  /** Latched true if the just-finished gesture was a drag — used to suppress the trailing click. */
  const didDrag = useRef(false);
  /** Active fling animation frame id (so we can cancel on a new pointer down or unmount). */
  const flingRaf = useRef<number | null>(null);

  // Cancel any in-flight fling when the component unmounts.
  useEffect(() => {
    return () => {
      if (flingRaf.current !== null) {
        cancelAnimationFrame(flingRaf.current);
        flingRaf.current = null;
      }
    };
  }, []);

  function cancelFling() {
    if (flingRaf.current !== null) {
      cancelAnimationFrame(flingRaf.current);
      flingRaf.current = null;
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Only intercept mouse/pen — leave touch to native momentum scroll.
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    // If a previous fling is still animating, interrupt it so the new gesture wins.
    cancelFling();
    drag.current = {
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      moved: false,
      snapBefore: el.style.scrollSnapType,
      samples: [{ t: performance.now(), x: e.clientX }],
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
      // Disable snap so the drag feels 1:1 instead of locking to each snap point.
      el.style.scrollSnapType = "none";
    }
    if (d.moved) {
      el.scrollLeft = d.startScroll - dx;
      // Record a velocity sample.
      const now = performance.now();
      d.samples.push({ t: now, x: e.clientX });
      // Drop samples older than the velocity window.
      while (d.samples.length > 2 && now - d.samples[0].t > VELOCITY_WINDOW_MS) {
        d.samples.shift();
      }
    }
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.releasePointerCapture(e.pointerId);

    if (d.moved) {
      // Estimate release velocity (px/ms, pointer-space). Negative scroll direction.
      const vx = estimateVelocity(d.samples);
      const snapBefore = d.snapBefore;
      drag.current = null;
      // If we got meaningful velocity, run a fling. Otherwise restore snap immediately
      // and let the browser settle to the nearest snap point.
      if (Math.abs(vx) >= MIN_VELOCITY) {
        startFling(el, vx, snapBefore);
      } else {
        el.style.scrollSnapType = snapBefore;
      }
    } else {
      // No movement — just a click. Restore snap (in case we touched it briefly).
      el.style.scrollSnapType = d.snapBefore;
      drag.current = null;
    }
  }

  function startFling(el: HTMLDivElement, initialVx: number, snapBefore: string) {
    // scrollLeft delta = -dx_pointer. Continue the same convention here.
    let vx = initialVx;
    let lastT = performance.now();
    const step = (now: number) => {
      const dt = now - lastT;
      lastT = now;
      el.scrollLeft -= vx * dt;
      // Stop if we've hit a scroll boundary — no point flinging into a wall.
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft <= 0 || el.scrollLeft >= max) {
        el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft));
        el.style.scrollSnapType = snapBefore;
        flingRaf.current = null;
        return;
      }
      // Exponential friction normalised to 60fps frames.
      vx *= Math.pow(FRICTION, dt / 16);
      if (Math.abs(vx) < MIN_VELOCITY) {
        // Restore CSS-managed snap; the browser snaps the remaining few pixels.
        el.style.scrollSnapType = snapBefore;
        flingRaf.current = null;
        return;
      }
      flingRaf.current = requestAnimationFrame(step);
    };
    flingRaf.current = requestAnimationFrame(step);
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

/**
 * Estimate pointer velocity (px / ms) from recent samples.
 * Uses the oldest sample inside the velocity window vs the newest sample.
 */
function estimateVelocity(samples: VelocitySample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples[0];
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.x - first.x) / dt;
}
