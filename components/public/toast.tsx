"use client";

import React, { useEffect, useState } from "react";

const TOAST_EVENT = "granite:toast";
const TOAST_DURATION_MS = 2500;

export type ToastVariant = "success" | "error";

type ToastDetail = { message: string; variant: ToastVariant };
type ToastItem = ToastDetail & { id: number };

let nextToastId = 1;

/**
 * 전역 토스트 표시. 어디서든 호출 가능 — site 레이아웃의 <Toaster/>가 수신한다.
 * CustomEvent 기반이라 context provider 체인 없이 동작한다.
 */
export function showToast(message: string, variant: ToastVariant = "success") {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, variant } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    function handleToast(event: Event) {
      const { message, variant } = (event as CustomEvent<ToastDetail>).detail;
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      timers.push(
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, TOAST_DURATION_MS)
      );
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-full max-w-[390px] -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <p
          key={toast.id}
          role="status"
          className={`w-fit rounded-full px-4 py-2 text-[13px] font-semibold leading-5 text-white shadow-lg ${
            toast.variant === "error" ? "bg-[#D93025]" : "bg-[#1A1A1A]"
          }`}
        >
          {toast.message}
        </p>
      ))}
    </div>
  );
}
