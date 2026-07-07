// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordSummary } from "./record-summary";
import type { UserRecordsModel } from "@/lib/db/schema";

const summary: UserRecordsModel["summary"] = {
  totalRecords: 7,
  highestGrade: "V8",
  latestSentAt: "2026-07-01T00:00:00.000Z",
  claimCandidateCount: 2
};

describe("RecordSummary", () => {
  it("renders record metrics", () => {
    render(<RecordSummary summary={summary} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("V8")).toBeInTheDocument();
    expect(screen.getByText("2026.07.01")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty latest date", () => {
    render(<RecordSummary summary={{ ...summary, latestSentAt: null }} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
