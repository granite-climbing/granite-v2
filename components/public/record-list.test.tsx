// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordList } from "./record-list";
import type { UserRecordListItem } from "@/lib/db/schema";

const record: UserRecordListItem = {
  betaId: "beta_1",
  routeId: "route_1",
  topoId: "topo_1",
  routeName: "Little Finger",
  routeGrade: "V5",
  routeGradeNum: 5,
  boulderName: "리틀핑거 바위",
  sectorName: "메인 섹터",
  cragName: "현충바위",
  platform: "instagram",
  mediaUrl: "https://www.instagram.com/reel/example/",
  thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
  sentAt: "2026-07-01T00:00:00.000Z",
  displayName: "granite_user"
};

describe("RecordList", () => {
  it("renders record rows", () => {
    render(<RecordList records={[record]} />);

    expect(screen.getByRole("link", { name: "Little Finger V5" })).toHaveAttribute(
      "href",
      "/t/topo_1?route=route_1"
    );
    expect(screen.getByText("현충바위 · 메인 섹터 · 리틀핑거 바위")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("2026.07.01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "베타 영상 열기" })).toHaveAttribute("href", record.mediaUrl);
  });

  it("renders empty state", () => {
    render(<RecordList records={[]} />);

    expect(screen.getByText("아직 연결된 기록이 없습니다.")).toBeInTheDocument();
  });
});
