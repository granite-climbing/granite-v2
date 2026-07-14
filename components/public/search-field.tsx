"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

export function SearchField({
  defaultValue,
  placeholder,
  action,
  hiddenFields,
  behavior = "submit",
  debounceMs = 600,
}: {
  defaultValue?: string;
  placeholder: string;
  action: string;
  hiddenFields?: Record<string, string>;
  behavior?: "submit" | "focus-redirect" | "debounced";
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue ?? "");
  const currentQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    setQuery(defaultValue ?? "");
  }, [defaultValue]);

  useEffect(() => {
    if (behavior !== "debounced") return;

    const handle = window.setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed === currentQuery) return;

      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${action}?${nextQuery}` : action, { scroll: false });
    }, debounceMs);

    return () => window.clearTimeout(handle);
  }, [action, behavior, currentQuery, debounceMs, query, router, searchParams]);

  function handleFocus() {
    if (behavior === "focus-redirect" && pathname !== action) {
      router.push(action);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (behavior !== "debounced") return;

    event.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${action}?${nextQuery}` : action, { scroll: false });
  }

  return (
    <form method="get" action={action} onSubmit={handleSubmit} className="relative mx-4">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <label>
        <span className="sr-only">검색</span>
        <input
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 w-full rounded-full border-0 bg-white px-4 pr-12 text-[14px] font-medium leading-5 text-[#090909] shadow-[0_0_6px_2px_rgba(0,0,0,0.1)] outline-none placeholder:text-[#B8B8B8] focus:shadow-[0_0_6px_2px_rgba(0,0,0,0.18)]"
        />
      </label>
      <button
        type="submit"
        aria-label="검색"
        className="absolute right-4 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-[#090909]"
      >
        <SearchIcon />
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="none">
      <path
        d="m20 20-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
