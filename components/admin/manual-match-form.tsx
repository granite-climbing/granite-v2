"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { btnPrimaryCls, inputCls } from "./admin-field";

export type ManualMatchRoute = {
  id: string;
  grade: string;
  name: string;
  boulderName: string;
};

const MAX_RESULTS = 50;

/**
 * Unmatched webhook → route 수동 매칭 폼. 기존 단순 `<select>`를 검색 가능한
 * combobox로 대체한다. 실제로 루트를 선택해야만 hidden `routeId`가 채워지고
 * 제출 버튼이 활성화되므로, 텍스트만 입력한 상태로는 매칭되지 않는다.
 */
export function ManualMatchForm({
  webhookId,
  routes,
  action,
}: {
  webhookId: string;
  routes: ManualMatchRoute[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const labelOf = (r: ManualMatchRoute) => `${r.grade} ${r.name} — ${r.boulderName}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? routes.filter((r) => labelOf(r).toLowerCase().includes(q)) : routes;
    return base.slice(0, MAX_RESULTS);
  }, [query, routes]);

  // 바깥 클릭 시 드롭다운 닫기.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectRoute(route: ManualMatchRoute) {
    setSelectedId(route.id);
    setQuery(labelOf(route));
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        selectRoute(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form action={action} className="flex items-start gap-2">
      <input type="hidden" name="webhookId" value={webhookId} />
      <input type="hidden" name="routeId" value={selectedId} />
      <div ref={rootRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId("");
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="루트 검색..."
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={`${inputCls} w-64`}
        />
        {open && filtered.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-64 w-64 overflow-auto rounded border border-[#D0D7DE] bg-white shadow-lg">
            {filtered.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectRoute(r)}
                  className={`block w-full px-3 py-1.5 text-left text-xs ${
                    i === activeIndex ? "bg-[#0969DA] text-white" : "text-[#24292F] hover:bg-[#F6F8FA]"
                  }`}
                >
                  {labelOf(r)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open && filtered.length === 0 ? (
          <div className="absolute z-20 mt-1 w-64 rounded border border-[#D0D7DE] bg-white px-3 py-2 text-xs text-[#6F7477] shadow-lg">
            검색 결과 없음
          </div>
        ) : null}
      </div>
      <button
        className={`${btnPrimaryCls} disabled:cursor-not-allowed disabled:opacity-50`}
        type="submit"
        disabled={!selectedId}
      >
        수동 매칭
      </button>
    </form>
  );
}
