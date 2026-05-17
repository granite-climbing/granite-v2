"use client";

import { useMemo, useRef, useState } from "react";
import type { Crag } from "@/lib/db/schema";
import { CragCard } from "./crag-card";

type CragCarouselProps = {
  crags: Array<Crag & { stats: { sectors: number; boulders: number; routes: number } }>;
};

const CARD_STEP = 286;

export function CragCarousel({ crags }: CragCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const indicators = useMemo(() => crags.map((crag) => crag.id), [crags]);

  function updateActiveIndex() {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const nextIndex = Math.round(scroller.scrollLeft / CARD_STEP);
    setActiveIndex(Math.max(0, Math.min(crags.length - 1, nextIndex)));
  }

  function scrollToCrag(index: number) {
    scrollerRef.current?.scrollTo({
      left: index * CARD_STEP,
      behavior: "smooth"
    });
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3"
        onScroll={updateActiveIndex}
      >
        {crags.map((crag) => (
          <div key={crag.id} className="snap-start">
            <CragCard crag={crag} />
          </div>
        ))}
      </div>
      {indicators.length > 1 ? (
        <div className="mt-[17px] flex justify-center gap-2">
          {indicators.map((indicator, index) => (
            <button
              key={indicator}
              type="button"
              className={`size-[6px] rounded-full ${
                index === activeIndex ? "bg-[#1A1A1A]" : "bg-[#D9D9D9]"
              }`}
              aria-label={`${index + 1}번째 크랙 보기`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => scrollToCrag(index)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
