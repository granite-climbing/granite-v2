"use client";

import { Map, MapMarker } from "react-kakao-maps-sdk";

type KakaoMapProps = {
  lat: number;
  lng: number;
  name: string;
  zoom?: number;
  className?: string;
};

export function KakaoMap({ lat, lng, name, zoom = 5, className }: KakaoMapProps) {
  return (
    <div className={className}>
      <Map
        center={{ lat, lng }}
        level={zoom}
        style={{ width: "100%", height: "100%" }}
      >
        <MapMarker position={{ lat, lng }} title={name} />
      </Map>
    </div>
  );
}
