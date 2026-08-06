"use client";

import { useRouter } from "next/navigation";

export function TopoBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // Prefer real history so tab state (Info/Route) is preserved. Fall back
        // to the Route tab when the topo was opened directly (shared link/new tab).
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      aria-label="뒤로 가기"
      className="absolute left-4 grid size-6 place-items-center text-[24px] leading-6"
    >
      ‹
    </button>
  );
}
