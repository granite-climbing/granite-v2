"use client";

import { useEffect, useRef, useState } from "react";
import { withdrawAccountAction } from "@/lib/actions/withdraw";

export function WithdrawButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14px] font-medium text-[#C8C8C8]"
      >
        회원탈퇴
      </button>
      {open ? <WithdrawConfirmDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function WithdrawConfirmDialog({ onClose }: { onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

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
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-6"
    >
      <div className="w-full max-w-[320px] rounded-[14px] bg-white p-5 text-center">
        <h2 id="withdraw-dialog-title" className="text-[16px] font-semibold text-[#050505]">
          정말로 탈퇴하시겠습니까?
        </h2>
        <p className="mt-2 text-[13px] font-medium leading-[18px] text-[#767676]">
          탈퇴 후 6개월간 데이터가 보관되며, 6개월 뒤 데이터는 일괄로 삭제됩니다.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-[8px] bg-[#F1F1F1] text-[14px] font-semibold text-[#050505]"
          >
            취소
          </button>
          <form action={withdrawAccountAction} className="flex-1">
            <button
              type="submit"
              className="h-11 w-full rounded-[8px] bg-[#FF1F1F] text-[14px] font-semibold text-white"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
