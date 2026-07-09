// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/actions/record", () => ({
  searchRoutesForRecordAction: vi.fn(),
  addRecordAction: vi.fn()
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

import { AddRecordLauncher } from "./add-record-launcher";

describe("AddRecordLauncher", () => {
  it("opens and closes the add-record dialog", () => {
    render(<AddRecordLauncher />);

    fireEvent.click(screen.getByRole("button", { name: "기록 추가" }));
    expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "기록 추가" })).not.toBeInTheDocument();
  });
});
