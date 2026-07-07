// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordGradeDistribution } from "./record-grade-distribution";

describe("RecordGradeDistribution", () => {
  it("renders grade buckets", () => {
    render(
      <RecordGradeDistribution
        buckets={[
          { grade: "V3", gradeNum: 3, count: 1 },
          { grade: "V5", gradeNum: 5, count: 3 }
        ]}
      />
    );

    expect(screen.getByText("V3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("V5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<RecordGradeDistribution buckets={[]} />);

    expect(screen.getByText("아직 분석할 기록이 없습니다.")).toBeInTheDocument();
  });
});
