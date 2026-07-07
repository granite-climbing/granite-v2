"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ManualBetaForm } from "./manual-beta-form";
import { BetaVideoGrid, type BetaVideoItem } from "./beta-video-grid";

export type RouteMoreSheetProps = {
  route: {
    id: string;
    name: string;
    grade: string;
    fa: string;
    description: string;
  };
  locationLabel: string;
  locationValue: string;
  caption: string;
  betaVideos: BetaVideoItem[];
  onClose: () => void;
};

export function RouteMoreSheet({
  route,
  locationLabel,
  locationValue,
  caption,
  betaVideos,
  onClose
}: RouteMoreSheetProps) {
  const [showManualForm, setShowManualForm] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const instagramHref = useMemo(
    () => `https://www.instagram.com/?caption=${encodeURIComponent(caption)}`,
    [caption]
  );

  async function copyAndOpenInstagram() {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // Best-effort copy: opening Instagram is the primary action, so we
      // continue even if the clipboard write is unavailable or rejected.
    }
    window.open(instagramHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 bg-black/60">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${route.name} 상세 정보`}
        className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[12px] bg-white"
      >
        <div className="mx-auto mt-2 h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
        <header className="relative flex h-[44px] items-center justify-center border-b border-[#E8E8E8]">
          <h2 className="text-[18px] font-medium leading-6 text-[#090909]">More</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 grid size-6 place-items-center text-[28px] leading-none text-[#121212]"
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="px-4 pb-6 pt-4">
          <div className="border-b border-[#E8E8E8] pb-4">
            <h3 className="text-[20px] font-semibold leading-7 text-[#090909]">{route.name}</h3>
            <dl className="mt-4 space-y-3 text-[14px] leading-5">
              <RouteDetailRow label="Grade" value={route.grade} />
              <RouteDetailRow label={locationLabel} value={locationValue} />
              <RouteDetailRow label="FA" value={route.fa || "-"} />
              <RouteDetailRow label="Description" value={route.description || "-"} />
            </dl>
          </div>

          <section className="pt-4">
            <h3 className="text-[18px] font-medium leading-6 text-[#090909]">베타 동영상</h3>
            <p className="mt-2 text-[14px] font-normal leading-5 text-[#2A2A2A]">
              캡션을 복사하여 인스타그램 게시물에 넣어주면 베타 영상이 루트에 연결됩니다.
            </p>
            <div className="mt-4 rounded-[10px] bg-[#F7F8F8] px-4 py-3 text-[14px] font-normal leading-5 text-[#2A2A2A]">
              <p>캡션</p>
              <p className="line-clamp-2 whitespace-pre-wrap">{caption}</p>
            </div>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={copyAndOpenInstagram}
                className="h-8 w-full rounded-full bg-[#1A1A1A] text-[14px] font-medium leading-5 text-white"
              >
                캡션 복사하고 Instagram 열기
              </button>
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="h-8 w-full rounded-full bg-[#1A1A1A] text-[14px] font-medium leading-5 text-white"
              >
                베타 영상 올리기
              </button>
            </div>
          </section>
        </div>

        <BetaVideoGrid items={betaVideos} />
      </section>

      {showManualForm ? (
        <ManualBetaForm routeId={route.id} onClose={() => setShowManualForm(false)} />
      ) : null}
    </div>
  );
}

function RouteDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3">
      <dt className="font-medium text-[#7A7A7A]">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap font-medium text-[#2A2A2A]">{value}</dd>
    </div>
  );
}
