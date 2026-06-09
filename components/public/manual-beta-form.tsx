"use client";

import { useActionState } from "react";
import { submitManualBetaAction } from "@/lib/actions/beta";

export function ManualBetaForm({
  routeId,
  onClose,
}: {
  routeId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (_state: { message: string } | null, formData: FormData) => {
    const result = await submitManualBetaAction(formData);
    if (result.ok) onClose();
    return { message: result.message };
  }, null);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <form action={formAction} className="w-full rounded-t-2xl bg-white p-4 shadow-xl">
        <input type="hidden" name="routeId" value={routeId} />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">베타 영상 올리기</h2>
          <button type="button" onClick={onClose} className="text-[14px] text-[#7A7A7A]">
            닫기
          </button>
        </div>
        <label className="mb-3 block text-[13px] font-medium">
          영상 URL
          <input name="mediaUrl" required type="url" className="mt-1 h-11 w-full rounded-lg border border-[#DADDE1] px-3" />
        </label>
        <label className="mb-4 block text-[13px] font-medium">
          완등 날짜
          <input name="sentAt" required type="date" className="mt-1 h-11 w-full rounded-lg border border-[#DADDE1] px-3" />
        </label>
        {state?.message ? (
          <p className="mb-3 text-[13px] leading-5 text-[#7A7A7A]">{state.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-[#1A1A1A] text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "등록 중" : "등록하기"}
        </button>
      </form>
    </div>
  );
}
