"use client";

import { useMemo, useState, useTransition } from "react";
import { convertW3wToCoordinatesAction } from "@/lib/actions/admin-location";
import { inputCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { KakaoMap } from "@/components/public/kakao-map";

type LocationCoordinateFieldProps = {
  latDefaultValue?: number | string | null;
  lngDefaultValue?: number | string | null;
  latRequired?: boolean;
  lngRequired?: boolean;
  previewName?: string;
};

function toInputValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseCoordinate(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LocationCoordinateField({
  latDefaultValue,
  lngDefaultValue,
  latRequired = false,
  lngRequired = false,
  previewName = "Location preview",
}: LocationCoordinateFieldProps) {
  const [words, setWords] = useState("");
  const [lat, setLat] = useState(toInputValue(latDefaultValue));
  const [lng, setLng] = useState(toInputValue(lngDefaultValue));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const marker = useMemo(() => {
    const parsedLat = parseCoordinate(lat);
    const parsedLng = parseCoordinate(lng);
    if (parsedLat === null || parsedLng === null) return null;
    return { lat: parsedLat, lng: parsedLng };
  }, [lat, lng]);

  function convertWords() {
    setMessage(null);
    startTransition(async () => {
      const result = await convertW3wToCoordinatesAction({ words });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setLat(String(result.lat));
      setLng(String(result.lng));
      setMessage("Coordinates updated from what3words.");
    });
  }

  return (
    <div className="col-span-2 space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-[#374151]">what3words</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={words}
              onChange={(event) => setWords(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  convertWords();
                }
              }}
              className={inputCls}
              placeholder="///filled.count.soap"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={convertWords}
              disabled={isPending}
              className={`${btnPrimaryCls} h-8 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isPending ? "Converting..." : "Convert"}
            </button>
          </div>
          {message ? <p className="mt-1 text-xs text-[#57606A]">{message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#374151]">
            Lat{latRequired ? " (required)" : ""}
          </label>
          <input
            name="lat"
            type="number"
            step="any"
            required={latRequired}
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            className={inputCls}
            placeholder="37.42"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#374151]">
            Lng{lngRequired ? " (required)" : ""}
          </label>
          <input
            name="lng"
            type="number"
            step="any"
            required={lngRequired}
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            className={inputCls}
            placeholder="126.92"
          />
        </div>
      </div>

      <div className="h-[220px] overflow-hidden rounded border border-[#D0D7DE] bg-[#F6F8FA]">
        {marker ? (
          <KakaoMap lat={marker.lat} lng={marker.lng} name={previewName} zoom={4} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[#6F7477]">
            Enter latitude and longitude to preview the marker.
          </div>
        )}
      </div>
    </div>
  );
}
