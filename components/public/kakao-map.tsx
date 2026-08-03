"use client";

import { useRef, useState } from "react";
import { CustomOverlayMap, Map, MapMarker } from "react-kakao-maps-sdk";

export type KakaoMapMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
};

type SinglePointProps = {
  /** Single-point mode (existing behavior). */
  lat: number;
  lng: number;
  name: string;
  zoom?: number;
  className?: string;
  /** Show a "current location" button that recenters on the visitor's GPS position. */
  locate?: boolean;
};

type MarkersProps = {
  /** Multi-marker mode. */
  markers: KakaoMapMarker[];
  onMarkerClick?: (id: string) => void;
  /** Center override — defaults to the centroid of the markers. */
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  /** Access the raw map instance after creation (e.g. to fit bounds). */
  onCreate?: (map: kakao.maps.Map) => void;
};

type KakaoMapProps = SinglePointProps | MarkersProps;

export function KakaoMap(props: KakaoMapProps) {
  if ("markers" in props) {
    return <MarkersMap {...props} />;
  }
  return <SinglePointMap {...props} />;
}

function MarkersMap({ markers, onMarkerClick, center, zoom = 11, className, onCreate }: MarkersProps) {
  if (markers.length === 0) return null;
  const computedCenter =
    center ?? {
      lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length,
      lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length,
    };
  return (
    <div className={className}>
      <Map center={computedCenter} level={zoom} style={{ width: "100%", height: "100%" }} onCreate={onCreate}>
        {markers.map((m) => (
          <MapMarker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.name}
            onClick={onMarkerClick ? () => onMarkerClick(m.id) : undefined}
          />
        ))}
      </Map>
    </div>
  );
}

function SinglePointMap({ lat, lng, name, zoom = 5, className, locate = false }: SinglePointProps) {
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.alert("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserPos(pos);
        setLocating(false);
        if (mapRef.current && window.kakao?.maps) {
          mapRef.current.panTo(new window.kakao.maps.LatLng(pos.lat, pos.lng));
        }
      },
      () => {
        setLocating(false);
        window.alert("현재 위치를 가져오지 못했습니다. 위치 권한을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <Map
        center={{ lat, lng }}
        level={zoom}
        style={{ width: "100%", height: "100%" }}
        onCreate={(map) => {
          mapRef.current = map;
        }}
      >
        <MapMarker position={{ lat, lng }} title={name} />
        {userPos ? (
          <CustomOverlayMap position={userPos}>
            <div className="size-4 rounded-full border-[3px] border-white bg-[#2B7FFF] shadow-[0_0_0_2px_rgba(43,127,255,0.35)]" />
          </CustomOverlayMap>
        ) : null}
      </Map>
      {locate ? (
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          aria-label="현재 위치"
          className="absolute bottom-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-white text-[#2A2A2A] shadow-[0_1px_4px_rgba(0,0,0,0.3)] disabled:opacity-60"
        >
          <LocateIcon className={`size-5 ${locating ? "animate-pulse" : ""}`} />
        </button>
      ) : null}
    </div>
  );
}

function LocateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
