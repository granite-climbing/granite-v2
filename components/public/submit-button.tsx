"use client";

import React from "react";
import { useFormStatus } from "react-dom";

/**
 * 서버 액션 폼 공용 제출 버튼. 부모 폼이 제출되는 동안 스피너 + pending 텍스트를
 * 표시하고 버튼을 비활성화해 중복 제출을 막는다. 서버 컴포넌트가 렌더하는
 * <form action={serverAction}> 안에서도 동작한다 (useFormStatus).
 */
export function SubmitButton({
  pendingText,
  className,
  children
}: {
  pendingText?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:opacity-60`}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner className="size-4" />
          {pendingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={`animate-spin ${className ?? ""}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
