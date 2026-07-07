// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordsProfileHeader } from "./records-profile-header";

const baseProps = {
  displayName: "granite_climber",
  instagramId: "granite.rocks",
  avatarUrl: null,
  reachCm: 178,
  heightCm: 182,
  weightKg: 68,
  totalSends: 126,
  highestGrade: "V10"
};

describe("RecordsProfileHeader", () => {
  it("renders profile identity, body stats, and send summary", () => {
    render(<RecordsProfileHeader {...baseProps} />);

    expect(screen.getByRole("heading", { name: "기록" })).toBeInTheDocument();
    expect(screen.getByText("granite_climber")).toBeInTheDocument();
    expect(screen.getByText("@granite.rocks")).toBeInTheDocument();
    expect(screen.getByText("178cm")).toBeInTheDocument();
    expect(screen.getByText("182cm")).toBeInTheDocument();
    expect(screen.getByText("68kg")).toBeInTheDocument();
    expect(screen.getByText("총 완등")).toBeInTheDocument();
    expect(screen.getByText("126")).toBeInTheDocument();
    expect(screen.getByText("최고 그레이드")).toBeInTheDocument();
    expect(screen.getByText("V10")).toBeInTheDocument();
  });

  it("omits the Instagram handle and missing body stats", () => {
    render(<RecordsProfileHeader {...baseProps} instagramId={null} weightKg={null} />);

    expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
    expect(screen.queryByText("68kg")).not.toBeInTheDocument();
    expect(screen.getByText("178cm")).toBeInTheDocument();
  });
});
