"use client";

import { Map, MapMarker } from "react-kakao-maps-sdk";

export type KakaoMapMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
};

type KakaoMapProps =
  | {
      /** Single-point mode (existing behavior). */
      lat: number;
      lng: number;
      name: string;
      zoom?: number;
      className?: string;
    }
  | {
      /** Multi-marker mode. */
      markers: KakaoMapMarker[];
      onMarkerClick?: (id: string) => void;
      /** Center override — defaults to the centroid of the markers. */
      center?: { lat: number; lng: number };
      zoom?: number;
      className?: string;
    };

export function KakaoMap(props: KakaoMapProps) {
  if ("markers" in props) {
    const { markers, onMarkerClick, center, zoom = 7, className } = props;
    if (markers.length === 0) return null;
    const computedCenter =
      center ?? {
        lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length,
        lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length,
      };
    return (
      <div className={className}>
        <Map center={computedCenter} level={zoom} style={{ width: "100%", height: "100%" }}>
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

  const { lat, lng, name, zoom = 5, className } = props;
  return (
    <div className={className}>
      <Map center={{ lat, lng }} level={zoom} style={{ width: "100%", height: "100%" }}>
        <MapMarker position={{ lat, lng }} title={name} />
      </Map>
    </div>
  );
}
