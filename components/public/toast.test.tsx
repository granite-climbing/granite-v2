// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { showToast, Toaster } from "./toast";

describe("Toaster", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast message and auto-dismisses it", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      showToast("프로젝트에 저장했습니다.");
    });
    expect(screen.getByRole("status")).toHaveTextContent("프로젝트에 저장했습니다.");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("styles error toasts differently from success toasts", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      showToast("실패했습니다.", "error");
    });

    expect(screen.getByRole("status").className).toContain("bg-[#D93025]");
  });
});
