"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function EditDrawer({
  title,
  closeHref,
  children,
}: {
  title: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Slide in on mount
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  // ESC key closes the drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setTimeout(() => router.push(closeHref), 200);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <Link
        href={closeHref}
        className={`absolute inset-0 bg-black transition-opacity duration-200 ${
          open ? "opacity-40" : "opacity-0"
        }`}
        aria-label="Close drawer"
      />

      {/* Panel */}
      <div
        className={`relative ml-auto flex h-full w-full max-w-[640px] flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E1E4E8] px-6 py-4">
          <h2 className="text-base font-bold text-[#111827]">{title}</h2>
          <Link
            href={closeHref}
            className="rounded p-1 text-[#57606A] hover:bg-[#F6F8FA] hover:text-[#111827]"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
