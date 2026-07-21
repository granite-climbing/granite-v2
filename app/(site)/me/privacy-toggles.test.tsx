// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateActionMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/privacy", () => ({
  updatePrivacyVisibilityAction: updateActionMock
}));
vi.mock("@/components/public/toast", () => ({
  showToast: showToastMock
}));

import { PrivacyToggles } from "./privacy-toggles";
import type { PrivacyRow } from "./me-page-model";

const rows: PrivacyRow[] = [
  { key: "height", label: "키", enabled: false, disabled: false },
  { key: "weight", label: "몸무게", enabled: false, disabled: false }
];

describe("PrivacyToggles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateActionMock.mockResolvedValue({ ok: true });
    updateActionMock.mockClear();
    showToastMock.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("toasts immediately with the label and new state on each toggle", () => {
    render(<PrivacyToggles rows={rows} />);

    fireEvent.click(screen.getByLabelText("키 공개 여부"));
    expect(showToastMock).toHaveBeenCalledWith("키 공개 여부가 활성화되었습니다");

    fireEvent.click(screen.getByLabelText("키 공개 여부"));
    expect(showToastMock).toHaveBeenLastCalledWith("키 공개 여부가 비활성화되었습니다");
  });

  it("debounces several toggles into a single batched update", () => {
    render(<PrivacyToggles rows={rows} />);

    fireEvent.click(screen.getByLabelText("키 공개 여부"));
    fireEvent.click(screen.getByLabelText("몸무게 공개 여부"));
    fireEvent.click(screen.getByLabelText("키 공개 여부"));

    expect(updateActionMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(updateActionMock).toHaveBeenCalledTimes(1);
    // 키는 두 번 눌러 원상복귀(false), 몸무게는 한 번 눌러 true — 마지막 값만 전송.
    expect(updateActionMock).toHaveBeenCalledWith({ height: false, weight: true });
  });
});
