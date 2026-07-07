// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordSendChart } from "./record-send-chart";

describe("RecordSendChart", () => {
  it("renders a bar per grade with counts and a disabled add action", () => {
    render(
      <RecordSendChart
        buckets={[
          { grade: "V0", count: 2 },
          { grade: "V1", count: 8 },
          { grade: "V2", count: 0 }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "완등 기록" })).toBeInTheDocument();
    expect(screen.getByText("V0")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기록 추가" })).toBeDisabled();
  });

  it("renders empty state when all counts are zero", () => {
    render(<RecordSendChart buckets={[{ grade: "V0", count: 0 }]} />);

    expect(screen.getByText("아직 완등 기록이 없습니다.")).toBeInTheDocument();
  });
});
