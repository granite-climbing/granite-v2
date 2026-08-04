"use client";

import { useRouter } from "next/navigation";

export function CragBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="뒤로 가기"
      className="absolute left-4 top-3 z-10 grid size-8 place-items-center rounded-full bg-white text-[20px] leading-none text-[#090909] shadow-[0_0_6px_2px_rgba(0,0,0,0.1)]"
    >
      ‹
    </button>
  );
}
