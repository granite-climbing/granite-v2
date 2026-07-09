"use client";

import React, { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildInstagramCaption } from "@/lib/beta/caption";
import { showToast } from "./toast";
import {
  addRecordAction,
  searchRoutesForRecordAction,
  type RouteSearchItemForRecord
} from "@/lib/actions/record";

export type AddRecordDialogProps = {
  prefilledRoute?: RouteSearchItemForRecord | null;
  onClose: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function AddRecordDialog({ prefilledRoute = null, onClose }: AddRecordDialogProps) {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState<RouteSearchItemForRecord | null>(prefilledRoute);
  const [term, setTerm] = useState(prefilledRoute?.routeName ?? "");
  const [results, setResults] = useState<RouteSearchItemForRecord[]>([]);
  const [, startSearch] = useTransition();
  const [sentAt, setSentAt] = useState(todayString());
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
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

  useEffect(() => {
    const trimmed = term.trim();
    if (!trimmed || (selectedRoute && trimmed === selectedRoute.routeName)) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchRoutesForRecordAction(trimmed));
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, selectedRoute]);

  const caption = useMemo(() => {
    if (!selectedRoute) {
      return "";
    }
    return buildInstagramCaption({
      cragName: selectedRoute.cragName,
      sectorName: selectedRoute.sectorName,
      boulderName: selectedRoute.boulderName,
      routeName: selectedRoute.routeName,
      grade: selectedRoute.routeGrade,
      boulderHashtags: selectedRoute.boulderHashtags
    });
  }, [selectedRoute]);

  const [state, formAction, pending] = useActionState(
    async (_state: { message: string } | null, formData: FormData) => {
      const result = await addRecordAction(formData);
      if (result.ok) {
        // 다이얼로그가 닫히면 인라인 메시지는 유실되므로 토스트로 알린다.
        showToast(result.message);
        router.refresh();
        onClose();
      }
      return { message: result.message };
    },
    null
  );

  function selectRoute(route: RouteSearchItemForRecord) {
    setSelectedRoute(route);
    setTerm(route.routeName);
    setResults([]);
  }

  async function copyCaptionAndOpenInstagram() {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // 클립보드 권한이 거부돼도 Instagram은 열어 사용자가 직접 작성할 수 있게 한다.
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="기록 추가"
      className="fixed inset-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 overflow-y-auto bg-white text-[#090909]"
    >
      <form action={formAction} className="flex min-h-full flex-col pb-8">
        <input type="hidden" name="routeId" value={selectedRoute?.routeId ?? ""} />
        <input type="hidden" name="rating" value={rating > 0 ? String(rating) : ""} />

        <header className="relative flex h-14 shrink-0 items-center justify-center">
          <h1 className="text-[18px] font-medium leading-6 text-[#090909]">기록 추가</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-4 grid size-6 place-items-center text-[#121212]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <section className="border-b-4 border-[#F1F1F1] px-4 pb-5 pt-2">
          <label className="block text-[14px] font-medium leading-5 text-[#090909]">
            루트명 <span className="text-[#FF3B30]">*</span>
            <span className="relative mt-2 block">
              <input
                type="text"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setSelectedRoute(null);
                }}
                placeholder="문제 이름을 검색해주세요"
                className="h-12 w-full rounded-[8px] border border-[#E8E8E8] pl-4 pr-11 text-[14px] leading-5 text-[#090909] placeholder:text-[#B8B8B8]"
              />
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="absolute right-4 top-1/2 size-5 -translate-y-1/2 fill-none stroke-[#090909]"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5L21 21" />
              </svg>
            </span>
          </label>
          {results.length > 0 ? (
            <ul className="mt-2 max-h-60 overflow-y-auto rounded-[8px] border border-[#E8E8E8]">
              {results.map((route) => (
                <li key={route.routeId} className="border-b border-[#E8E8E8] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => selectRoute(route)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[14px] font-medium leading-5 text-[#090909]">
                        {route.routeName}
                      </span>
                      <span className="block text-[11px] leading-4 text-[#7A7A7A]">
                        {route.boulderName} · {route.cragName}
                      </span>
                    </span>
                    <span className="text-[14px] font-medium leading-5 text-[#2A2A2A]">
                      {route.routeGrade}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="border-b-4 border-[#F1F1F1] px-4 py-5">
          <label className="block text-[14px] font-medium leading-5 text-[#090909]">
            완등 날짜 <span className="text-[#FF3B30]">*</span>
            <input
              type="date"
              name="sentAt"
              value={sentAt}
              onChange={(event) => setSentAt(event.target.value)}
              className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4 text-[14px] leading-5 text-[#090909]"
            />
          </label>
        </section>

        {selectedRoute ? (
          <>
            <section className="border-b-4 border-[#F1F1F1] px-4 py-5">
              <h2 className="text-[14px] font-medium leading-5 text-[#090909]">루트 평가</h2>
              <div className="mt-3 flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`별점 ${value}점`}
                    aria-pressed={rating >= value}
                    onClick={() => setRating(rating === value ? 0 : value)}
                    className="grid size-9 place-items-center"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className={`size-9 ${rating >= value ? "fill-[#FFD60A]" : "fill-[#E8E8E8]"}`}
                    >
                      <path d="M12 2l2.9 6.26L21.5 9.2l-4.75 4.4 1.15 6.6L12 17.1l-5.9 3.1 1.15-6.6L2.5 9.2l6.6-.94L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
            </section>

            <section className="px-4 py-5">
              <h2 className="text-[14px] font-medium leading-5 text-[#090909]">영상 추가</h2>
              <p className="mt-1 text-[12px] leading-4 text-[#7A7A7A]">
                아래 캡션을 복사 후, 인스타그램 게시물 포스트 하단에 작성해주세요.
              </p>
              <p className="mt-3 rounded-[8px] bg-[#F7F8F8] px-4 py-3 text-[12px] leading-5 text-[#3A3A3A]">
                {caption}
              </p>
              <button
                type="button"
                onClick={copyCaptionAndOpenInstagram}
                className="mt-3 h-11 w-full rounded-full bg-[#1A1A1A] text-[14px] font-semibold leading-5 text-white"
              >
                캡션 복사하고 → Instagram 열기
              </button>

              <label className="mt-5 block text-[14px] font-medium leading-5 text-[#090909]">
                링크로 영상 추가
                <input
                  type="url"
                  name="mediaUrl"
                  placeholder="Youtube 혹은 Instagram 링크"
                  className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4 text-[14px] leading-5 text-[#090909] placeholder:text-[#B8B8B8]"
                />
              </label>
            </section>
          </>
        ) : null}

        {state?.message ? (
          <p className="px-4 pb-2 text-[13px] leading-5 text-[#7A7A7A]">{state.message}</p>
        ) : null}

        <div className="mt-auto px-4 pt-4">
          <button
            type="submit"
            disabled={pending || !selectedRoute || !sentAt}
            className="h-14 w-full rounded-full bg-[#1A1A1A] text-[16px] font-semibold leading-6 text-white disabled:opacity-40"
          >
            {pending ? "추가 중" : "추가하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
