"use client";

import React, { useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./toast";
import { BetaVideoSheet } from "./beta-video-sheet";
import { AddRecordDialog } from "./add-record-dialog";
import type { BetaVideoItem } from "./beta-video-grid";
import type { ProjectActionResult } from "@/lib/actions/project";
import type { RouteSearchItemForRecord } from "@/lib/actions/record";

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
  saved: boolean;
  returnTo: string;
  saveAction: (formData: FormData) => Promise<ProjectActionResult>;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
  recordRoute: RouteSearchItemForRecord;
  isLoggedIn: boolean;
  onClose: () => void;
};

// TODO(phase-8): 실제 Records/Claims 데이터로 교체 — 현재는 Figma 시안용 mock.
const MOCK_RATING = { average: 4.5, solidGrade: "V4", feelsGrade: "V4.1", ascents: 1027, ratingCount: 32, stars: 4 };
const MOCK_GRADE_DISTRIBUTION = [
  { grade: "V3", count: 4, ratio: 0.35 },
  { grade: "V4", count: 18, ratio: 0.78 },
  { grade: "V5", count: 7, ratio: 0.5 },
  { grade: "V6", count: 2, ratio: 0.15 }
];
const MOCK_COMMENTS = [
  { id: "mock_1", nickname: "닉네임", timeAgo: "7months ago", body: "완등이 어려웠어요ㅜㅜ", feelsGrade: "V11", stars: 4 },
  { id: "mock_2", nickname: "닉네임", timeAgo: "7months ago", body: "완등이 어려웠어요ㅜㅜ", feelsGrade: "V11", stars: 4 }
];

export function RouteMoreSheet({
  route,
  breadcrumb,
  caption,
  betaVideos,
  saved,
  returnTo,
  saveAction,
  removeAction,
  recordRoute,
  isLoggedIn,
  onClose
}: RouteMoreSheetProps) {
  const router = useRouter();
  const [showBetaSheet, setShowBetaSheet] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function handleAddRecordClick() {
    if (!isLoggedIn) {
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setShowAddRecord(true);
  }

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

  const formattedAscents = MOCK_RATING.ascents.toLocaleString("en-US");

  return (
    <div className="fixed inset-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 bg-black/60">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${route.name} 상세 정보`}
        className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[12px] bg-white"
      >
        <div className="mx-auto mt-2 h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
        <header className="flex h-[44px] items-center justify-between px-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-6 place-items-center text-[#121212]"
          >
            <ArrowLeftIcon className="size-6" />
          </button>
          <div className="flex items-center gap-2">
            <BookmarkToggleButton
              routeId={route.id}
              saved={saved}
              returnTo={returnTo}
              saveAction={saveAction}
              removeAction={removeAction}
            />
            <button
              type="button"
              aria-label="완등 기록"
              onClick={handleAddRecordClick}
              className="size-6 text-[#121212]"
            >
              <DoubleCheckIcon className="size-6" />
            </button>
            <button type="button" aria-label="공유하기" className="size-6 text-[#121212]">
              <ShareIcon className="size-6" />
            </button>
          </div>
        </header>

        <div className="px-4 pb-6">
          <p className="text-[10px] font-normal leading-[14px]">
            <span className="text-[#B8B8B8]">{breadcrumbPrefix} &gt; </span>
            <span className="text-[#5A5A5A]">{breadcrumb.boulderName}</span>
          </p>
          <div className="mt-1 flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((index) => (
                <Star key={index} filled={index < MOCK_RATING.stars} className="size-3.5" />
              ))}
            </div>
            <span className="text-[10px] leading-[14px] text-[#B8B8B8]">{MOCK_RATING.ratingCount}</span>
          </div>
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

          <div className="mx-auto mt-4 flex w-full items-center rounded-[4px] bg-white p-4 shadow-[0px_0px_6px_2px_rgba(0,0,0,0.1)]">
            <div className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[12px] font-medium text-[#090909]">
                {MOCK_RATING.average}, Solid {MOCK_RATING.solidGrade}
              </span>
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Star key={index} filled={index < MOCK_RATING.stars} className="size-5" />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[8px] leading-3 text-[#090909]">
                  <ChartIcon className="size-3" />
                  Feels {MOCK_RATING.feelsGrade}
                </span>
                <span className="flex items-center gap-1 text-[8px] leading-3 text-[#090909]">
                  <CheckIcon className="size-3" />
                  Ascents {formattedAscents}
                </span>
              </div>
            </div>
            <div className="mx-4 h-[52px] self-center border-l border-[#E8E8E8]" />
            <div className="flex flex-1 flex-col gap-1.5">
              {MOCK_GRADE_DISTRIBUTION.map((row) => (
                <div key={row.grade} className="flex items-center gap-2">
                  <span className="w-5 text-[8px] text-[#2A2A2A]">{row.grade}</span>
                  <div className="h-[5px] w-[84px] rounded-full bg-[#E8E8E8]">
                    <div
                      className="h-[5px] rounded-full bg-[#2A2A2A]"
                      style={{ width: `${Math.round(row.ratio * 84)}px` }}
                    />
                  </div>
                  <span className="text-[8px] text-[#2A2A2A]">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h4 className="text-[14px] font-medium leading-5 text-[#2A2A2A]">Ascents comment</h4>
            <button
              type="button"
              className="flex items-center gap-0.5 text-[12px] font-medium leading-4 text-[#7A7A7A]"
            >
              <PencilIcon className="size-4" />
              기록하기
            </button>
          </div>
          <div>
            {MOCK_COMMENTS.map((comment) => (
              <div key={comment.id} className="border-t border-[#E8E8E8] py-3">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-full bg-[#9747FF]" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-[12px] font-bold leading-4 text-[#2A2A2A]">{comment.nickname}</span>
                    <span className="text-[10px] leading-[14px] text-[#7A7A7A]">{comment.timeAgo}</span>
                  </div>
                </div>
                <p className="mt-2 text-[12px] font-medium leading-4 text-[#2A2A2A]">{comment.body}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex h-4 items-center gap-0.5 rounded-full bg-[#E8E8E8] px-1.5 text-[8px] leading-3 text-[#3A3A3A]">
                    <ChartIcon className="size-2" />
                    Feels <span className="font-semibold">{comment.feelsGrade}</span>
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <Star key={index} filled={index < comment.stars} className="size-3.5" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
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
      {showAddRecord ? (
        <AddRecordDialog prefilledRoute={recordRoute} onClose={() => setShowAddRecord(false)} />
      ) : null}
    </div>
  );
}

function BookmarkToggleButton({
  routeId,
  saved,
  returnTo,
  saveAction,
  removeAction
}: {
  routeId: string;
  saved: boolean;
  returnTo: string;
  saveAction: (formData: FormData) => Promise<ProjectActionResult>;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
}) {
  // 서버 왕복(1초+)을 기다리지 않고 아이콘을 즉시 토글한다.
  // 액션 실패 시 transition이 끝나면 saved prop 값으로 자동 롤백된다.
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, formAction, pending] = useActionState(
    async (_state: ProjectActionResult | null, formData: FormData) => {
      setOptimisticSaved(!saved);
      const result = saved ? await removeAction(formData) : await saveAction(formData);
      showToast(result.message, result.ok ? "success" : "error");
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label="북마크"
        aria-pressed={optimisticSaved}
        disabled={pending}
        className="size-6 text-[#121212]"
      >
        <BookmarkIcon className="size-6" filled={optimisticSaved} />
      </button>
    </form>
  );
}

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6.99988 9.91667L3.57115 12.0109L4.50337 8.10285L1.45207 5.48907L5.45696 5.16799L6.99988 1.45833L8.54286 5.16799L12.5477 5.48907L9.49643 8.10285L10.4287 12.0109L6.99988 9.91667Z"
        fill={filled ? "#FFE311" : "#E8E8E8"}
      />
    </svg>
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

function BookmarkIcon({ className, filled }: { className?: string; filled?: boolean }) {
  const outerPath =
    "M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z";
  const innerCutout = "M18 4H6V19.4324L12 15.6707L18 19.4324V4Z";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d={filled ? outerPath : outerPath + innerCutout} fill="currentColor" />
    </svg>
  );
}

function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M11.602 13.7599L13.014 15.1719L21.4795 6.7063L22.8938 8.12051L13.014 18.0003L6.65 11.6363L8.06421 10.2221L10.189 12.3469L11.602 13.7599ZM11.6037 10.9322L16.5563 5.97949L17.9666 7.38977L13.014 12.3424L11.6037 10.9322ZM8.77698 16.5873L7.36396 18.0003L1 11.6363L2.41421 10.2221L3.82723 11.6352L3.82604 11.6363L8.77698 16.5873Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2.58582L18.2071 8.79292L16.7929 10.2071L13 6.41424V16H11V6.41424L7.20711 10.2071L5.79289 8.79292L12 2.58582ZM3 18V14H5V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V14H21V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" fill="none" aria-hidden="true" className={className}>
      <path
        d="M1 4H2.33333V7H1V4ZM5.66667 2.66667H7V7H5.66667V2.66667ZM3.33333 0.666667H4.66667V7H3.33333V0.666667Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4.99985 7.58545L9.59605 2.98926L10.3032 3.69637L4.99985 8.99965L1.81787 5.8177L2.52498 5.1106L4.99985 7.58545Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8.59967 4.56969L11.4281 7.39813L4.82843 13.9978H2V11.1693L8.59967 4.56969ZM9.54247 3.62688L10.9567 2.21267C11.2171 1.95232 11.6391 1.95232 11.8995 2.21267L13.7851 4.09829C14.0455 4.35863 14.0455 4.78075 13.7851 5.04109L12.3709 6.45531L9.54247 3.62688Z"
        fill="currentColor"
      />
    </svg>
  );
}
