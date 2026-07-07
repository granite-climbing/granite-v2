// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordList } from "./record-list";

describe("RecordList", () => {
  it("renders recent record rows and a disabled All action", () => {
    render(
      <RecordList
        records={[
          { id: "mock_record_1", routeName: "Midnight", grade: "V5", location: "더 클라임 성수" },
          { id: "mock_record_2", routeName: "Little Finger", grade: "V4", location: "현충바위" }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "최근 기록" })).toBeInTheDocument();
    expect(screen.getByText("Midnight · V5 · 더 클라임 성수")).toBeInTheDocument();
    expect(screen.getByText("Little Finger · V4 · 현충바위")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeDisabled();
  });

  it("renders empty state", () => {
    render(<RecordList records={[]} />);

    expect(screen.getByText("아직 완등 기록이 없습니다.")).toBeInTheDocument();
  });
});
