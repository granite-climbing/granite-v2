"use client";

import React, { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/public/toast";

const CONTACT_EMAIL = "granite.korea@gmail.com";

export function ContactButton() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // 모달이 열려 있는 동안 ESC 키로 닫고, 배경 스크롤을 막는다.
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      showToast("이메일 주소가 복사되었습니다");
    } catch {
      showToast("복사에 실패했습니다. 직접 입력해 주세요.", "error");
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[14px] font-medium"
      >
        문의
        <ChevronRight />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="문의"
          className="fixed inset-0 z-[70] flex items-center justify-center px-8"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-[320px] rounded-2xl bg-white px-6 py-7 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[16px] font-semibold text-[#050505]">문의</h2>
            <p className="mt-2 text-[13px] font-medium leading-5 text-[#8A8A8A]">
              아래 이메일로 문의를 보내주세요.
            </p>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F2F2F2] px-4 py-3 text-[14px] font-semibold text-[#050505]"
            >
              <span className="truncate">{CONTACT_EMAIL}</span>
              <CopyIcon />
            </button>

            <button
              type="button"
              onClick={close}
              className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-[14px] font-semibold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
      <path d="m4.5 2.5 3 3.5-3 3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-[#8A8A8A]" aria-hidden>
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.75 5.25V3.75a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h1.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
