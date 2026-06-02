"use client";

import { useCallback } from "react";
import { KakaoMap, type KakaoMapMarker } from "@/components/public/kakao-map";

type AreaOverviewMapProps = {
  markers: KakaoMapMarker[];
  className?: string;
};

/**
 * Shows all Crags in an Area on a single Kakao Map. Clicking a marker scrolls
 * the corresponding Crag card into view and adds a brief visual highlight.
 *
 * Cards must be siblings somewhere in the DOM with `id="crag-card-${cragId}"`.
 */
export function AreaOverviewMap({ markers, className }: AreaOverviewMapProps) {
  const onMarkerClick = useCallback((id: string) => {
    const el = document.getElementById(`crag-card-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#090909]");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-[#090909]"), 1500);
  }, []);

  if (markers.length === 0) return null;

  return <KakaoMap markers={markers} onMarkerClick={onMarkerClick} className={className} />;
}
