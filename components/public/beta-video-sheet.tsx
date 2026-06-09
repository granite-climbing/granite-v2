"use client";

import { useEffect, useMemo, useState } from "react";
import { ManualBetaForm } from "./manual-beta-form";
import { BetaVideoGrid, type BetaVideoItem } from "./beta-video-grid";

export function BetaVideoSheet({
  routeId,
  caption,
  betaVideos,
  onClose,
}: {
  routeId: string;
  caption: string;
  betaVideos: BetaVideoItem[];
  onClose: () => void;
}) {
  const [showManualForm, setShowManualForm] = useState(false);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  const instagramHref = useMemo(
    () => `https://www.instagram.com/?caption=${encodeURIComponent(caption)}`,
    [caption]
  );

  async function copyAndOpenInstagram() {
    await navigator.clipboard.writeText(caption);
    window.open(instagramHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 -translate-x-1/2 left-1/2 z-50 bg-black/60 max-w-[430px] w-full">
      <section className="absolute inset-x-0 bottom-0 top-[352px] overflow-y-auto rounded-t-[12px] bg-white">
        <div className="mx-auto mt-2 h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
        <header className="relative flex h-[38px] items-center justify-center border-b border-[#E8E8E8]">
          <h2 className="text-[18px] font-medium leading-6 text-[#090909]">베타 동영상</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 grid size-6 place-items-center text-[28px] leading-none text-[#121212]"
            aria-label="닫기"
          >
            ×
          </button>
        </header>
        <div className="px-4 pb-6 pt-4">
          <p className="text-[14px] font-normal leading-5 text-[#2A2A2A]">
            캡션을 복사하여 인스타그램 게시물에 넣어주면 베타 영상이 루트에 연결됩니다.
          </p>
          <div className="mt-5 rounded-[10px] bg-[#F7F8F8] px-4 py-3 text-[14px] font-normal leading-5 text-[#2A2A2A]">
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
        </div>
        <BetaVideoGrid items={betaVideos} />
      </section>
      {showManualForm ? (
        <ManualBetaForm routeId={routeId} onClose={() => setShowManualForm(false)} />
      ) : null}
    </div>
  );
}
