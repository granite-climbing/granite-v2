// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("marks the More trigger with dialog popup semantics that reflect open state", () => {
    render(<RouteMoreActions {...baseProps} />);

    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the sheet when Escape is pressed", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("dialog", { name: "Little Finger 상세 정보" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Little Finger 상세 정보" })).not.toBeInTheDocument();
  });

  it("dismisses only the topmost layer on Escape when the manual beta form is open", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "베타 영상 올리기" }));
    expect(screen.getByText("영상 URL")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("영상 URL")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Little Finger 상세 정보" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Little Finger 상세 정보" })).not.toBeInTheDocument();
  });

  it("moves focus to the close button when the sheet opens", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("still opens Instagram when the clipboard write fails", () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard unavailable"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "캡션 복사하고 Instagram 열기" }));

    return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      expect(writeText).toHaveBeenCalledWith(baseProps.caption);
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining("https://www.instagram.com/?caption="),
        "_blank",
        "noopener,noreferrer"
      );
    });
  });
});
