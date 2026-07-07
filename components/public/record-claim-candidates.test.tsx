// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordClaimCandidates } from "./record-claim-candidates";
import type { UserRecordClaimCandidate } from "@/lib/db/schema";

const candidate: UserRecordClaimCandidate = {
  betaId: "beta_2",
  routeId: "route_2",
  topoId: "topo_2",
  routeName: "Even Flow",
  routeGrade: "V7",
  routeGradeNum: 7,
  boulderName: "이븐플로우 바위",
  sectorName: "메인 섹터",
  cragName: "인수봉",
  platform: "instagram",
  mediaUrl: "https://www.instagram.com/reel/candidate/",
  thumbnailUrl: null,
  sentAt: "2026-07-02T00:00:00.000Z",
  displayName: "granite_user",
  instagramId: "granite_user",
  claimStatus: "unclaimed"
};

describe("RecordClaimCandidates", () => {
  it("renders matching claim candidates with disabled action", () => {
    render(<RecordClaimCandidates instagramId="granite_user" candidates={[candidate]} />);

    expect(screen.getByText("@granite_user")).toBeInTheDocument();
    expect(screen.getByText("Even Flow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "연결 준비중" })).toBeDisabled();
  });

  it("renders no Instagram state", () => {
    render(<RecordClaimCandidates instagramId={null} candidates={[]} />);

    expect(screen.getByText("Instagram ID를 등록하면 연결 가능한 기록을 확인할 수 있습니다.")).toBeInTheDocument();
  });

  it("renders empty candidate state", () => {
    render(<RecordClaimCandidates instagramId="granite_user" candidates={[]} />);

    expect(screen.getByText("연결 가능한 기록이 없습니다.")).toBeInTheDocument();
  });
});
