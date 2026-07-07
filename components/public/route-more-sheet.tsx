"use client";

import React, { useEffect, useRef, useState } from "react";
import { BetaVideoSheet } from "./beta-video-sheet";
import type { BetaVideoItem } from "./beta-video-grid";

export type RouteMoreSheetProps = {
  route: {
    id: string;
    name: string;
    grade: string;
    fa: string;
    description: string;
  };
  breadcrumb: {
    areaName: string | null;
    cragName: string;
    sectorName: string;
    boulderName: string;
  };
  caption: string;
  betaVideos: BetaVideoItem[];
  onClose: () => void;
};

export function RouteMoreSheet({
  route,
  breadcrumb,
  caption,
  betaVideos,
  onClose
}: RouteMoreSheetProps) {
  const [showBetaSheet, setShowBetaSheet] = useState(false);
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
      if (event.key === "Escape" && !event.defaultPrevented) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const breadcrumbPrefix = [breadcrumb.areaName, breadcrumb.cragName, breadcrumb.sectorName]
    .filter((part): part is string => Boolean(part))
    .join(" > ");

  return (
    <div className="fixed inset-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 bg-black/60">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${route.name} 상세 정보`}
        className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[12px] bg-white"
      >
        <div className="mx-auto mt-2 h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
        <header className="flex h-[44px] items-center px-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-6 place-items-center text-[#121212]"
          >
            <ArrowLeftIcon className="size-6" />
          </button>
        </header>

        <div className="px-4 pb-6">
          <p className="text-[10px] font-normal leading-[14px]">
            <span className="text-[#B8B8B8]">{breadcrumbPrefix} &gt; </span>
            <span className="text-[#5A5A5A]">{breadcrumb.boulderName}</span>
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <h3 className="text-[20px] font-medium leading-7 text-[#2A2A2A]">{route.name}</h3>
            <span className="text-[18px] font-medium leading-6 text-[#2A2A2A]">{route.grade}</span>
          </div>
          {route.fa ? (
            <p className="mt-1 text-[10px] leading-[14px] text-[#7A7A7A]">FA {route.fa}</p>
          ) : null}
          {route.description ? (
            <p className="mt-1 text-[10px] leading-[14px] text-[#7A7A7A]">{route.description}</p>
          ) : null}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowBetaSheet(true)}
              className="flex h-6 w-[72px] items-center justify-center gap-1 rounded-full bg-[#E8E8E8] text-[12px] font-medium leading-4 text-[#3A3A3A]"
            >
              <VideoIcon className="size-4" />
              beta
            </button>
          </div>
        </div>
      </section>

      {showBetaSheet ? (
        <BetaVideoSheet
          routeId={route.id}
          caption={caption}
          betaVideos={betaVideos}
          onClose={() => setShowBetaSheet(false)}
        />
      ) : null}
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"
        fill="currentColor"
      />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M11.3333 6.13333L14.8089 3.70047C14.9597 3.5949 15.1675 3.63158 15.2731 3.7824C15.3123 3.83843 15.3333 3.90516 15.3333 3.97355V12.0265C15.3333 12.2105 15.1841 12.3598 15 12.3598C14.9316 12.3598 14.8649 12.3387 14.8089 12.2995L11.3333 9.86667V12.6667C11.3333 13.0349 11.0349 13.3333 10.6667 13.3333H1.33333C0.965147 13.3333 0.666667 13.0349 0.666667 12.6667V3.33333C0.666667 2.96515 0.965147 2.66667 1.33333 2.66667H10.6667C11.0349 2.66667 11.3333 2.96515 11.3333 3.33333V6.13333Z"
        fill="currentColor"
      />
    </svg>
  );
}
