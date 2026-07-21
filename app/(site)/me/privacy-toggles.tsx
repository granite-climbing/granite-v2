"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/components/public/toast";
import { updatePrivacyVisibilityAction } from "@/lib/actions/privacy";
import type { PrivacyVisibilityKey } from "@/lib/user/privacy-visibility";
import type { PrivacyRow } from "./me-page-model";

/** 여러 토글을 한꺼번에 눌러도 마지막 클릭 뒤 한 번만 저장되도록 하는 디바운스 간격. */
const FLUSH_DELAY_MS = 500;

type ToggleRow = PrivacyRow & { key: PrivacyVisibilityKey };

function hasKey(row: PrivacyRow): row is ToggleRow {
  return typeof row.key === "string";
}

export function PrivacyToggles({ rows }: { rows: PrivacyRow[] }) {
  const toggleRows = rows.filter(hasKey);

  const initial = () =>
    toggleRows.reduce((acc, row) => {
      acc[row.key] = row.enabled;
      return acc;
    }, {} as Record<PrivacyVisibilityKey, boolean>);

  const [state, setState] = useState<Record<PrivacyVisibilityKey, boolean>>(initial);

  // 아직 서버에 반영되지 않은 변경분을 모아 뒀다가 한 번에 전송한다.
  const pendingRef = useRef<Partial<Record<PrivacyVisibilityKey, boolean>>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) {
      return;
    }
    void updatePrivacyVisibilityAction(patch as Record<string, boolean>).then((result) => {
      if (!result.ok) {
        showToast(result.message ?? "저장에 실패했습니다.", "error");
      }
    });
  }, []);

  // 마운트 해제(페이지 이탈) 시 아직 남은 변경분을 저장한다.
  useEffect(() => flush, [flush]);

  const handleToggle = useCallback(
    (row: ToggleRow) => {
      setState((prev) => {
        const nextValue = !prev[row.key];
        pendingRef.current[row.key] = nextValue;
        showToast(`${row.label} 공개 여부가 ${nextValue ? "활성화" : "비활성화"}되었습니다`);
        return { ...prev, [row.key]: nextValue };
      });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [flush]
  );

  return (
    <div className="space-y-[13px]">
      {toggleRows.map((row) => {
        const enabled = state[row.key];
        return (
          <div key={row.key} className="flex h-[20px] items-center justify-between text-[14px] font-medium">
            <span>{row.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`${row.label} 공개 여부`}
              onClick={() => handleToggle(row)}
              className={`relative h-[20px] w-[43px] rounded-full transition ${
                enabled ? "bg-black" : "bg-[#BBBBBB]"
              }`}
            >
              <span
                className={`absolute top-[2px] size-[16px] rounded-full bg-white transition ${
                  enabled ? "left-[25px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
