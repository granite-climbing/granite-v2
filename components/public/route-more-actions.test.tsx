// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteMoreActions } from "./route-more-actions";
import type { BetaVideoItem } from "./beta-video-grid";

const betaVideos: BetaVideoItem[] = [
  {
    id: "beta_1",
    mediaUrl: "https://www.instagram.com/reel/example/",
    thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
    displayName: "granite_user"
  }
];

const baseProps = {
  route: {
    id: "route_1",
    name: "Little Finger",
    grade: "V5",
    fa: "FA Unknown",
    description: "왼손 언더와 오른손 크림프를 이용해 오른다."
  },
  locationLabel: "Location",
  locationValue: "현충바위 · 메인섹터 · 리틀핑거 바위",
  caption: "[현충바위] 메인섹터 / 리틀핑거 바위 / Little Finger (V5)\n@granite.kr #리틀핑거바위 #LittleFinger",
  betaVideos
};

describe("RouteMoreActions", () => {
  it("opens route details from the More button", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("dialog", { name: "Little Finger 상세 정보" })).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("현충바위 · 메인섹터 · 리틀핑거 바위")).toBeInTheDocument();
    expect(screen.getByText("V5")).toBeInTheDocument();
    expect(screen.getByText("FA Unknown")).toBeInTheDocument();
    expect(screen.getByText("베타 동영상")).toBeInTheDocument();
    expect(screen.getByLabelText("granite_user 베타 영상 열기")).toBeInTheDocument();
  });

  it("closes the sheet", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "Little Finger 상세 정보" })).not.toBeInTheDocument();
  });

  it("opens the manual beta form from the More sheet", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "베타 영상 올리기" }));

    expect(screen.getByText("영상 URL")).toBeInTheDocument();
  });
});
