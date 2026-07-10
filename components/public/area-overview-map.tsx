"use client";

import { useCallback } from "react";
import { KakaoMap, type KakaoMapMarker } from "@/components/public/kakao-map";

type AreaOverviewMapProps = {
  markers: KakaoMapMarker[];
  className?: string;
  /**
   * Fixed view override — when set, bounds fitting is skipped and the map
   * stays at this center/level (e.g. the 전체 view showing all of Korea).
   */
  fixedView?: { center: { lat: number; lng: number }; zoom: number };
};

/**
 * Shows all Crags in an Area on a single Kakao Map. Clicking a marker scrolls
 * the corresponding Crag card into view and adds a brief visual highlight.
 *
 * Cards must be siblings somewhere in the DOM with `id="crag-card-${cragId}"`.
 */
export function AreaOverviewMap({ markers, className, fixedView }: AreaOverviewMapProps) {
  const onMarkerClick = useCallback((id: string) => {
    const el = document.getElementById(`crag-card-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#090909]");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-[#090909]"), 1500);
  }, []);

  // Fit every marker in view, then step three levels further out so the
  // surrounding region stays visible. Single-marker areas keep the default
  // (zoomed-out) level from KakaoMap instead — setBounds would zoom all the
  // way in. Skipped entirely when a fixedView is given.
  const onCreate = useCallback(
    (map: kakao.maps.Map) => {
      if (fixedView || markers.length < 2) return;
      const bounds = new kakao.maps.LatLngBounds();
      for (const m of markers) {
        bounds.extend(new kakao.maps.LatLng(m.lat, m.lng));
      }
      map.setBounds(bounds, 32, 32, 32, 32);
      map.setLevel(map.getLevel() + 3);
    },
    [markers, fixedView]
  );

  if (markers.length === 0) return null;

  return (
    <KakaoMap
      markers={markers}
      onMarkerClick={onMarkerClick}
      onCreate={onCreate}
      center={fixedView?.center}
      zoom={fixedView?.zoom}
      className={className}
    />
  );
}
